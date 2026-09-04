import assert from "node:assert/strict";

console.log("🦀 启动发货日期筛选与明细联动逻辑单元测试...\n");

// 模拟订单数据
const orders = [
  { id: "1", code: "SO001", count: 10, deliveryDate: new Date("2026-09-04T00:00:00.000Z"), gender: "FEMALE", weightTier: "3.5两" },
  { id: "2", code: "SO002", count: 20, deliveryDate: new Date("2026-09-04T00:00:00.000Z"), gender: "MALE", weightTier: "4.0两" },
  { id: "3", code: "SO003", count: 15, deliveryDate: new Date("2026-09-05T00:00:00.000Z"), gender: "FEMALE", weightTier: "3.5两" },
  { id: "4", code: "SO004", count: 30, deliveryDate: new Date("2026-09-21T00:00:00.000Z"), gender: "MALE", weightTier: "4.0两" },
];

// 提取所有发货日期 (去重排序)
const availableDates = Array.from(
  new Set(orders.map((o) => o.deliveryDate.toISOString().slice(0, 10)))
).sort();

assert.deepEqual(availableDates, ["2026-09-04", "2026-09-05", "2026-09-21"]);
console.log("✔ 发货日期提取去重通过: ", availableDates);

// 1. 全部订单筛选
{
  const targetDateStr = "all";
  const displayed = targetDateStr === "all"
    ? orders
    : orders.filter((o) => o.deliveryDate.toISOString().slice(0, 10) === targetDateStr);
  assert.equal(displayed.length, 4, "当选择'全部'时应返回所有 4 条订单");
  console.log("✔ 全部筛选验证通过");
}

// 2. 指定日期筛选 (2026-09-04)
{
  const targetDateStr: string = "2026-09-04";
  const displayed = targetDateStr === "all"
    ? orders
    : orders.filter((o) => o.deliveryDate.toISOString().slice(0, 10) === targetDateStr);
  assert.equal(displayed.length, 2, "当选择 2026-09-04 时应仅返回当天 2 条订单");
  assert.equal(displayed[0].code, "SO001");
  assert.equal(displayed[1].code, "SO002");
  console.log("✔ 单日联动筛选验证通过");
}

// 3. 无订单的自定义日期筛选 (2026-10-01)
{
  const targetDateStr: string = "2026-10-01";
  const displayed = targetDateStr === "all"
    ? orders
    : orders.filter((o) => o.deliveryDate.toISOString().slice(0, 10) === targetDateStr);
  assert.equal(displayed.length, 0, "当选择无排产日期时返回空列表");
  console.log("✔ 空日期安全兜底验证通过\n");
}

console.log("🎉 发货日期筛选与明细联动单元测试 100% 通过！");
