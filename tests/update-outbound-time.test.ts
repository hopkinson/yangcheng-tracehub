import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";
import { prisma } from "../src/lib/prisma";
import { readOutboundTimeItems, updateOutboundTimes } from "../scripts/update-outbound-time";
import { formatFullDateTime, parseBeijingDateTime } from "../src/lib/utils";

function workbook(rows: unknown[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "出库单");
  return book;
}

test("Excel 按完整批次逐笔更新：预览、校验、不同时间和审计必须在同一事务内", async (t) => {
  const book = workbook([
    ["出库批次", "出库时间"],
    ["CK-20261007-012", 46303.0069444445],
    ["CK-20261007-011", 46302.4895833333],
    [],
    ["CK-20261007-001", "2026-10-07 17:30"],
    [],
    ["出库批次", "规格数量"],
    ["CK-20261007-011", 120],
  ]);
  // 经过真实 xlsx 编码/解码，覆盖数值日期与文本日期混合的导出文件。
  const items = readOutboundTimeItems(XLSX.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), { type: "buffer" }), "来源.xlsx");
  assert.equal(items.length, 3, "不能读取后面的规格矩阵");
  assert.deepEqual(items.map((item) => formatFullDateTime(item.newOutboundTime)), [
    "2026-10-08 00:10:00", "2026-10-07 11:45:00", "2026-10-07 17:30:00",
  ]);
  const serial1904 = workbook([["出库批次", "出库时间"], ["CK-20261007-011", 46302.4895833333 - 1462]]);
  serial1904.Workbook = { WBProps: { date1904: true } };
  assert.equal(formatFullDateTime(readOutboundTimeItems(serial1904, "1904.xlsx")[0].newOutboundTime), "2026-10-07 11:45:00");
  for (const invalid of ["", "2026-02-30 11:45", "2026-10-07 24:30", "not-a-time"]) {
    assert.throws(() => readOutboundTimeItems(workbook([["出库批次", "出库时间"], ["CK-20261007-011", invalid]]), "bad.xlsx"), /时间/);
  }

  let orders = items.map((item, index) => ({
    id: `order-${index}`, code: item.code,
    outboundTime: parseBeijingDateTime("2026-10-08 00:10"),
    status: "APPROVED", createdAt: parseBeijingDateTime("2026-10-07 15:24"),
  }));
  let logs: { operatorId: string; entityId: string; details: string }[] = [];
  let transactions = 0;
  let writes = 0;
  let failAudit = false;
  const original = prisma.$transaction;
  t.after(() => { prisma.$transaction = original; });
  // 暂存写入，只有整个回调成功才提交；强制第二条审计失败以验证整批事务边界。
  prisma.$transaction = (async (callback: any) => {
    transactions++;
    const stagedOrders = structuredClone(orders);
    const stagedLogs = structuredClone(logs);
    const tx = {
      user: { findUnique: async ({ where }: any) => where.id === "admin" ? { role: "ADMIN" } : null },
      outboundOrder: {
        findMany: async ({ where }: any) => structuredClone(stagedOrders.filter((o) => where.code.in.includes(o.code))),
        update: async ({ where, data }: any) => {
          writes++;
          Object.assign(stagedOrders.find((o) => o.id === where.id)!, data);
        },
      },
      auditLog: { create: async ({ data }: any) => {
        if (failAudit && stagedLogs.length === 1) throw new Error("审计写入失败");
        stagedLogs.push(data);
      } },
    };
    const result = await callback(tx);
    orders = stagedOrders;
    logs = stagedLogs;
    return result;
  }) as typeof prisma.$transaction;

  const preview = await updateOutboundTimes(items);
  assert.deepEqual([preview.applied, preview.total, preview.count, preview.skipped], [false, 3, 2, 1]);
  assert.equal(writes, 0);
  assert.equal(logs.length, 0);
  await assert.rejects(updateOutboundTimes([...items, items[0]]), /重复/);
  await assert.rejects(updateOutboundTimes([{ code: "CK-20261007-", newOutboundTime: "2026-10-07 11:45" }]), /批次号无效/);
  await assert.rejects(updateOutboundTimes([...items, { code: "CK-20261007-999", newOutboundTime: "2026-10-07 11:45" }], { apply: true, operatorId: "admin" }), /未找到/);
  await assert.rejects(updateOutboundTimes(items, { apply: true }), /operator/);
  await assert.rejects(updateOutboundTimes(items, { apply: true, operatorId: "missing" }), /管理员/);
  assert.equal(writes, 0, "整批校验通过前不得写入");

  failAudit = true;
  const beforeFailure = structuredClone(orders);
  await assert.rejects(updateOutboundTimes(items, { apply: true, operatorId: "admin" }), /审计写入失败/);
  assert.deepEqual(orders, beforeFailure);
  assert.equal(logs.length, 0);
  failAudit = false;
  transactions = 0;
  const result = await updateOutboundTimes(items, { apply: true, operatorId: "admin" });
  assert.equal(transactions, 1, "整批必须使用一个事务");
  assert.equal(result.count, 2);
  assert.deepEqual(orders.map((o) => formatFullDateTime(o.outboundTime)), items.map((item) => formatFullDateTime(item.newOutboundTime)));
  assert.ok(orders.every((o) => o.status === "APPROVED" && formatFullDateTime(o.createdAt) === "2026-10-07 15:24:00"));
  assert.equal(logs.length, 2);
  const detail = JSON.parse(logs[0].details);
  assert.equal(detail.orderCode, "CK-20261007-011");
  assert.equal(detail.sourceFile, "来源.xlsx");
  assert.equal(detail.sourceRow, 3);
  assert.equal(detail.previousOutboundTime, parseBeijingDateTime("2026-10-08 00:10").toISOString());
  assert.equal(detail.newOutboundTime, parseBeijingDateTime("2026-10-07 11:45").toISOString());
  const repeated = await updateOutboundTimes(items, { apply: true, operatorId: "admin" });
  assert.equal(repeated.count, 0, "重复执行不能再次修改或增加日志");
  assert.equal(logs.length, 2);
});
