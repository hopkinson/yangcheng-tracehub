import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import nextCache from "next/cache";
import { prisma } from "../src/lib/prisma";
import { createOutboundOrderAction, resubmitOutboundOrderAction } from "../src/actions/outbound";
import { approveOutboundOrderAction } from "../src/actions/approvals";

function stub(t: TestContext, target: any, key: string, fn: (...args: any[]) => any) {
  const original = target[key];
  target[key] = fn;
  t.after(() => { target[key] = original; });
}

test("预约时间在申请、审核、驳回重提时保留并留痕", async t => {
  const scheduled = new Date("2026-10-01T00:00:00+08:00");
  let order: any;
  const logs: any[] = [];
  stub(t, prisma.user, "findFirst", async () => ({ id: "admin", role: "ADMIN" }));
  stub(t, prisma, "$queryRaw", async () => []);
  t.mock.method(nextCache, "revalidatePath", () => {});
  const tx = {
    batch: { findUniqueOrThrow: async () => ({ status: "ACTIVE", inPoolCount: 100, outPoolCount: 0, lossCount: 0 }) },
    store: { findUniqueOrThrow: async () => ({ channelId: "channel" }) },
    outboundOrder: {
      count: async () => 0,
      create: async ({ data }: any) => { order = { id: "outbound", ...data, lines: [] }; return order; },
      findUniqueOrThrow: async () => ({ ...order, batch: null }),
      update: async ({ data }: any) => { order = { ...order, ...data }; return order; },
    },
    auditLog: { create: async ({ data }: any) => { logs.push({ ...data, details: JSON.parse(data.details) }); return data; } },
  };
  stub(t, prisma, "$transaction", async (fn: any) => fn(tx));

  await createOutboundOrderAction({ batchId: "batch", storeId: "store", outboundCount: 10,
    applicantId: "admin", outboundTime: "2026-10-01T00:00:00+08:00" });
  assert.equal(logs[0].details.outboundTime, scheduled.toISOString());
  assert.equal(logs[0].operatorId, "admin");
  await approveOutboundOrderAction({ orderId: order.id, approved: false, rejectReason: "调整预约" });
  assert.equal(order.outboundTime.getTime(), scheduled.getTime());
  assert.equal(logs[1].details.outboundTime, scheduled.toISOString());

  // 重提读取完整批次对象，随后审核夹具只需要冷库出库场景的空 batch。
  tx.outboundOrder.findUniqueOrThrow = async () => ({ ...order, batch: { status: "ACTIVE" } });
  await resubmitOutboundOrderAction({ orderId: order.id, storeId: "store", outboundCount: 10,
    applicantId: "admin", outboundTime: "2026-10-01T01:00:00+08:00" });
  const revised = new Date("2026-10-01T01:00:00+08:00");
  assert.equal(logs[2].details.previousOutboundTime, scheduled.toISOString());
  assert.equal(logs[2].details.outboundTime, revised.toISOString());

  tx.outboundOrder.findUniqueOrThrow = async () => ({ ...order, batch: null });
  await approveOutboundOrderAction({ orderId: order.id, approved: true });
  assert.equal(order.outboundTime.getTime(), revised.getTime(), "审核不得覆盖用户预约时间");
  assert.notEqual(order.approvedAt.getTime(), order.outboundTime.getTime());
  assert.equal(logs[3].details.outboundTime, revised.toISOString());
});
