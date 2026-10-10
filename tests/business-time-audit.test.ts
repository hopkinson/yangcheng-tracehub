import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import nextCache from "next/cache";
import * as utils from "../src/lib/utils";
import { Invariants } from "../src/lib/invariants";
import { prisma } from "../src/lib/prisma";
import { requestTagClaimAction, resubmitTagClaimAction } from "../src/actions/tags";
import { tagClaimTimeSchema } from "../src/lib/validations/schemas";
import { checkFarmerNameAction, createFarmerAction } from "../src/actions/farmers";
import { completeDailyCloseAction } from "../src/actions/daily-close";

// Prisma 的动态代理不暴露方法描述符，直接替换并在测试结束时恢复。
function stub(t: TestContext, target: any, key: string, fn: (...args: any[]) => any) {
  const original = target[key];
  const mocked = t.mock.fn(fn);
  target[key] = mocked;
  t.after(() => { target[key] = original; });
  return mocked;
}

test("业务时间在 UTC 服务器上保持北京时间口径", async (t) => {
  const originalTZ = process.env.TZ;
  process.env.TZ = "UTC";
  t.after(() => { if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ; });
  const clock = t.mock.timers;
  clock.enable({ apis: ["Date"], now: new Date("2026-10-08T02:30:00+08:00") });
  stub(t, prisma.user, "findFirst", async () => ({ id: "admin", role: "ADMIN" }));
  t.mock.method(nextCache, "revalidatePath", () => {});
  await t.test("日期输入按北京时间零点解析，带时区的时间保持原意", () => {
    assert.equal(utils.formatFullDateTime(utils.parseBeijingDateTime("2026-10-08")), "2026-10-08 00:00:00");
    assert.equal(utils.formatFullDateTime(utils.parseBeijingDateTime("2026-10-08T02:00")), "2026-10-08 02:00:00");
    assert.equal(utils.formatFullDateTime(utils.parseBeijingDateTime("2026-10-07T18:00:00Z")), "2026-10-08 02:00:00");
  });
  await t.test("凌晨领扣使用北京当日，前日未轧平查询以北京零点为界", async (t) => {
    let boundary: Date | undefined;
    let saved: any;
    const tx = {
      farmer: { findUniqueOrThrow: async () => ({ quota: 6000, batches: [{ inPoolCount: 100 }], tagClaims: [] }) },
      tagClaim: {
        findFirst: async (query: any) => { boundary = query.where.claimDate.lt; return null; },
        count: async () => 0,
        create: async ({ data }: any) => { saved = data; return data; },
      },
      auditLog: { create: async () => ({}) },
    };
    stub(t, prisma, "$transaction", async (fn: any) => fn(tx));
    await requestTagClaimAction({ farmerId: "farmer", claimCount: 10, applicantId: "admin" });
    assert.equal(utils.formatFullDateTime(boundary), "2026-10-08 00:00:00");
    assert.equal(saved.code, "XK2026100801");
    assert.equal(utils.formatISODate(saved.claimDate), "2026-10-08");
    assert.equal(utils.formatDateTime(saved.claimDate), "2026-10-08 02:30");
    await requestTagClaimAction({ farmerId: "farmer", claimCount: 10, applicantId: "admin", claimDate: "2026-10-07T18:45" });
    assert.equal(utils.formatDateTime(saved.claimDate), "2026-10-07 18:45");
    assert.equal(utils.formatFullDateTime(boundary), "2026-10-08 00:00:00");
    assert.equal(saved.code, "XK2026100801");
    assert.equal(tagClaimTimeSchema.safeParse("2026-02-30T12:00").success, false);
    assert.equal(tagClaimTimeSchema.safeParse("2026-10-08T25:00").success, false);
    await assert.rejects(requestTagClaimAction({ farmerId: "farmer", claimCount: 10, applicantId: "admin", claimDate: "" }));
  });
  await t.test("驳回重提保存修改的申领时间并清空旧审批信息", async (t) => {
    let saved: any;
    const tx = {
      tagClaim: {
        findUniqueOrThrow: async () => ({
          id: "claim", status: "REJECTED", claimDate: new Date("2026-10-07T12:00+08:00"),
          farmer: { code: "JD", quota: 6000, batches: [{ inPoolCount: 100 }], tagClaims: [] },
        }),
        update: async ({ data }: any) => { saved = data; return data; },
      },
      auditLog: { create: async () => ({}) },
    };
    stub(t, prisma, "$transaction", async (fn: any) => fn(tx));
    await resubmitTagClaimAction({ claimId: "claim", claimCount: 10, applicantId: "admin", claimDate: "2026-10-08T01:15" });
    assert.equal(utils.formatDateTime(saved.claimDate), "2026-10-08 01:15");
    assert.equal(saved.status, "PENDING");
    assert.equal(saved.approvedAt, null);
    assert.equal(saved.approverId, null);
    assert.equal(saved.approvalComment, null);
  });
  await t.test("跨年建档与姓名查重使用北京年份", async (t) => {
    clock.setTime(new Date("2027-01-01T02:00:00+08:00").getTime());
    t.after(() => clock.setTime(new Date("2026-10-08T02:30:00+08:00").getTime()));
    const years: number[] = [];
    const farmer = { findFirst: async ({ where }: any) => { years.push(where.year); return { id: "existing", code: "JD", name: "测试户" }; } };
    stub(t, prisma.farmer, "findFirst", farmer.findFirst);
    stub(t, prisma, "$transaction", async (fn: any) => fn({ farmer }));
    await checkFarmerNameAction({ name: "测试户" });
    await createFarmerAction({ name: "测试户", area: 10, creditRating: "A", enclosureCodes: [], userId: "admin" });
    assert.deepEqual(years, [2027, 2027]);
    assert.equal(Invariants.normalizeDateStr("1月1日"), "2027-01-01");
  });
  await t.test("日结按已审核单业务出库日开放，与首页一致", async (t) => {
    stub(t, prisma.auditLog, "findFirst", async () => null);
    stub(t, prisma.auditLog, "create", async () => ({}));
    stub(t, prisma.batch, "findMany", async () => []);
    let outbound: { status: string; date: Date };
    const findFirst = stub(t, prisma.outboundOrder, "findFirst", async ({ where }: any) => {
      assert.deepEqual(where, { status: "APPROVED", outboundTime: utils.getBeijingDayRange("2026-10-08") });
      return outbound.status === where.status && outbound.date >= where.outboundTime.gte && outbound.date <= where.outboundTime.lte ? { id: "outbound" } : null;
    });
    for (const [status, outboundTime, expected] of [
      ["APPROVED", "2026-10-08T02:00+08:00", true],
      ["PENDING", "2026-10-08T02:00+08:00", false],
      ["APPROVED", "2026-10-09T02:00+08:00", false],
    ] as const) {
      outbound = { status, date: new Date(outboundTime) };
      const result = await completeDailyCloseAction("POOL");
      assert.equal(result.success, expected, `${status}，出库 ${outboundTime} 的日结开放结果`);
      assert.equal(findFirst.mock.callCount(), 1);
      findFirst.mock.resetCalls();
    }
  });
});
