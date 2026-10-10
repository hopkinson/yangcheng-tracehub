import assert from "node:assert/strict";
import { test } from "node:test";
import prisma from "../src/lib/prisma";
import { completeBundleBatchAction } from "../src/actions/production";
import { bundleCompletionTimeSchema } from "../src/lib/validations/schemas";
import { formatDateTime } from "../src/lib/utils";
import { calculateTagClaimLedger } from "../src/lib/tag-claim-ledger";

test("捆扎完成保存可编辑的北京时间并保持数量守恒", async (t) => {
  const previousTZ = process.env.TZ;
  process.env.TZ = "UTC";
  t.after(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-10T00:30:00+08:00") });
  const originalAdmin = prisma.user.findFirst;
  const originalBatch = prisma.bundleBatch.findUnique;
  const originalTransaction = prisma.$transaction;
  t.after(() => {
    prisma.user.findFirst = originalAdmin;
    prisma.bundleBatch.findUnique = originalBatch;
    prisma.$transaction = originalTransaction;
  });
  prisma.user.findFirst = (async () => ({ id: "admin", role: "ADMIN" })) as any;
  prisma.bundleBatch.findUnique = (async () => ({
    id: "bundle", code: "KZD-test", status: "BUNDLING", groupId: "group", tagClaimId: "claim",
    lines: [{ id: "line", count: 100 }],
  })) as any;
  let saved: any;
  let savedLine: any;
  let savedClaim: any;
  let transactions = 0;
  prisma.$transaction = (async (fn: any) => {
    transactions++;
    return fn({
      bundleBatch: { updateMany: async ({ data }: any) => { saved = data; return { count: 1 }; } },
      bundleLine: { update: async ({ data }: any) => { savedLine = data; } },
      bundleGroup: { update: async () => ({}) },
      tagClaim: {
        findUnique: async () => ({ id: "claim", claimCount: 100, boundCount: 0, returnedCount: 0, scrappedCount: 0 }),
        updateMany: async ({ data }: any) => { savedClaim = data; return { count: 1 }; },
      },
    });
  }) as any;

  const lines = [{ lineId: "line", qualifiedCount: 98 }];
  const result = await completeBundleBatchAction("bundle", lines, "", "2026-10-09T23:45");
  assert.equal(result.success, true);
  assert.equal(saved.doneAt.toISOString(), "2026-10-09T15:45:00.000Z");
  assert.equal(formatDateTime(saved.doneAt), "2026-10-09 23:45");
  assert.equal(saved.inputCount - saved.qualifiedCount, saved.lossCount);
  assert.equal(savedLine.qualifiedCount, 98);
  assert.equal(savedLine.lossCount, 2);
  assert.equal(savedClaim.boundCount, 98, "仅合格数归集为绑扎数");
  const daily = calculateTagClaimLedger([], [{
    farmerId: "farmer", claimDate: new Date("2026-10-09T12:00:00+08:00"),
    claimCount: 100, returnedCount: 0, scrappedCount: 0, status: "APPROVED",
    bundleBatches: [saved],
  }]);
  assert.equal(daily[0].dailyBound, 98, "跨日提交按所选完成日归集");

  for (const doneAt of ["", "invalid", "2026-02-30T12:00", "2026-10-10T25:00", "2026-10-10T00:31"]) {
    assert.equal(bundleCompletionTimeSchema.safeParse({ doneAt }).success, false);
    assert.equal((await completeBundleBatchAction("bundle", lines, "", doneAt)).success, false);
  }
  assert.equal(transactions, 1, "非法时间不能写入数据库");
  assert.equal((await completeBundleBatchAction("bundle", [{ lineId: "line", qualifiedCount: 90 }], "", "2026-10-09T23:45")).success, false);
  assert.equal(transactions, 1, "超过 5% 的损耗仍须填写原因");
  assert.equal((await completeBundleBatchAction("bundle", lines)).success, true);
  assert.equal(saved.doneAt.toISOString(), "2026-10-09T16:30:00.000Z", "旧调用未传时间时默认当前时间");
});
