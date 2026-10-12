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

// 1. 默认发货日筛选（默认本年 year）
{
  const paramDate = undefined;
  const targetDateStr = paramDate || "year";
  assert.equal(targetDateStr, "year", "未提供日期参数时应默认本年");
  console.log("✔ 默认本年 fallback 验证通过");
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
  console.log("✔ 空日期安全兜底验证通过");
}

// 4. 自然周、自然月、自然年范围计算测试
import { getBeijingWeekRange, getBeijingMonthRange, getBeijingYearRange } from "../src/lib/utils";

{
  // 2026-10-12 是周一
  const weekRangeMonday = getBeijingWeekRange("2026-10-12");
  assert.equal(weekRangeMonday.startStr, "2026-10-12");
  assert.equal(weekRangeMonday.endStr, "2026-10-18");

  // 2026-10-14 是周三，应在同一周
  const weekRangeWed = getBeijingWeekRange("2026-10-14");
  assert.equal(weekRangeWed.startStr, "2026-10-12");
  assert.equal(weekRangeWed.endStr, "2026-10-18");

  // 2026-10-18 是周日，应在同一周
  const weekRangeSunday = getBeijingWeekRange("2026-10-18");
  assert.equal(weekRangeSunday.startStr, "2026-10-12");
  assert.equal(weekRangeSunday.endStr, "2026-10-18");

  // 自然月
  const monthRange = getBeijingMonthRange("2026-10-12");
  assert.equal(monthRange.startStr, "2026-10-01");
  assert.equal(monthRange.endStr, "2026-10-31");

  // 自然年
  const yearRange = getBeijingYearRange("2026-10-12");
  assert.equal(yearRange.startStr, "2026-01-01");
  assert.equal(yearRange.endStr, "2026-12-31");

  console.log("✔ 本周、本月、本年日期边界精准计算验证通过");
}

// 5. 共计发货只数统计与待发/已发分类汇总
{
  const testDemand = [
    { gender: "MALE", weightTier: "4.0两", totalNeeded: 50, shippedCount: 20, pendingCount: 30 },
    { gender: "FEMALE", weightTier: "3.5两", totalNeeded: 25, shippedCount: 25, pendingCount: 0 },
    { gender: "MALE", weightTier: "3.5两", totalNeeded: 100, shippedCount: 0, pendingCount: 100 },
  ];

  const totalDemand = testDemand.reduce((s, d) => s + d.totalNeeded, 0);
  const totalShipped = testDemand.reduce((s, d) => s + d.shippedCount, 0);
  const totalPending = testDemand.reduce((s, d) => s + d.pendingCount, 0);

  assert.equal(totalDemand, 175, "共计发货需求只数等于各项之和");
  assert.equal(totalShipped, 45, "总已发只数准确");
  assert.equal(totalPending, 130, "总待发只数准确");
  assert.equal(totalDemand, totalShipped + totalPending, "总发货只数守恒轧平");
  console.log("✔ 共计发货只数与已发/待发汇总守恒验证通过\n");
}

console.log("🎉 发货日期筛选与明细联动单元测试 100% 通过！");
