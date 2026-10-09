import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "../src/lib/prisma";
import { updateOutboundTimes } from "../scripts/update-outbound-time";
import { parseBeijingDateTime } from "../src/lib/utils";

test("出库批次时间批量修改工具正确更新并记录审计日志", async (t) => {
  let mockOrder: any = {
    id: "ord-001",
    code: "CK-20261001-005",
    outboundTime: new Date("2026-10-01T15:33:35+08:00"),
    status: "APPROVED",
  };
  const logs: any[] = [];

  const stub = (obj: any, key: string, fn: any) => {
    const orig = obj[key];
    obj[key] = fn;
    t.after(() => { obj[key] = orig; });
  };

  stub(prisma.outboundOrder, "findUnique", async ({ where }: any) => {
    return where.code === mockOrder.code ? mockOrder : null;
  });

  const tx = {
    outboundOrder: {
      update: async ({ data }: any) => {
        mockOrder = { ...mockOrder, ...data };
        return mockOrder;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        logs.push({ ...data, details: JSON.parse(data.details) });
        return data;
      },
    },
  };

  stub(prisma, "$transaction", async (fn: any) => fn(tx));

  const targetTimeStr = "2026-10-02 00:10";
  const expectedDate = parseBeijingDateTime(targetTimeStr);

  const res = await updateOutboundTimes([
    { code: "CK-20261001-005", newOutboundTime: targetTimeStr },
  ]);

  assert.equal(res.success, true);
  assert.equal(res.count, 1);
  assert.equal(mockOrder.outboundTime.getTime(), expectedDate.getTime());

  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "UPDATE_OUTBOUND_TIME");
  assert.equal(logs[0].details.orderCode, "CK-20261001-005");
  assert.equal(logs[0].details.newOutboundTime, expectedDate.toISOString());
});
