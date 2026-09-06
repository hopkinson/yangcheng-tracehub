import assert from "node:assert";
import {
  formatDate,
  formatDateTime,
  formatShortDateTime,
  formatFullDateTime,
  formatTime,
  formatISODate,
  formatISOMonth,
  getBeijingDateStr,
  getBeijingYear,
} from "../src/lib/utils";

console.log("🕒 启动北京时间格式化与时区一致性自动化测试...");

// 案例 1: UTC 2026-09-21 00:30:00Z -> 北京时间 2026-09-21 08:30:00
const testDate1 = new Date("2026-09-21T00:30:00.000Z");

console.log("▶ [Test 1] 标准北京时间转换 (UTC 00:30 -> 北京 08:30)");
assert.strictEqual(formatDate(testDate1), "2026-09-21", "formatDate 必须为 2026-09-21");
assert.strictEqual(formatTime(testDate1), "08:30", "formatTime 必须为 08:30");
assert.strictEqual(formatDateTime(testDate1), "2026-09-21 08:30", "formatDateTime 必须为 2026-09-21 08:30");
assert.strictEqual(formatShortDateTime(testDate1), "09-21 08:30", "formatShortDateTime 必须为 09-21 08:30");
assert.strictEqual(formatFullDateTime(testDate1), "2026-09-21 08:30:00", "formatFullDateTime 必须为 2026-09-21 08:30:00");
assert.strictEqual(formatISODate(testDate1), "2026-09-21", "formatISODate 必须为 2026-09-21");
assert.strictEqual(formatISOMonth(testDate1), "2026-09", "formatISOMonth 必须为 2026-09");
assert.strictEqual(getBeijingDateStr(testDate1), "20260921", "getBeijingDateStr 必须为 20260921");
assert.strictEqual(getBeijingYear(testDate1), 2026, "getBeijingYear 必须为 2026");
console.log("  ✔ 标准时间转换各项格式正确");

// 案例 2: 跨日边界测试 (UTC 20:00 前一天 -> 北京时间次日 04:00)
const testDate2 = new Date("2026-09-20T20:00:00.000Z");
console.log("▶ [Test 2] 跨日时区边界测试 (UTC 2026-09-20 20:00 -> 北京 2026-09-21 04:00)");
assert.strictEqual(formatDate(testDate2), "2026-09-21", "北京时间日期必须是 2026-09-21，不能是 2026-09-20");
assert.strictEqual(formatTime(testDate2), "04:00", "北京时间必须是 04:00，不能是 20:00");
assert.strictEqual(formatShortDateTime(testDate2), "09-21 04:00", "formatShortDateTime 必须跨日为 09-21 04:00");
console.log("  ✔ 跨日时区边界转换正确");

// 案例 3: 跨年边界测试 (UTC 2026-12-31 17:00 -> 北京 2027-01-01 01:00)
const testDate3 = new Date("2026-12-31T17:00:00.000Z");
console.log("▶ [Test 3] 跨年时区边界测试 (UTC 2026-12-31 17:00 -> 北京 2027-01-01 01:00)");
assert.strictEqual(getBeijingYear(testDate3), 2027, "北京年份必须为 2027，不能误算为 2026");
assert.strictEqual(formatDate(testDate3), "2027-01-01", "北京日期必须为 2027-01-01");
assert.strictEqual(formatTime(testDate3), "01:00", "北京时间必须为 01:00");
console.log("  ✔ 跨年时区边界年份正确");

// 案例 4: 空值与异常容错
console.log("▶ [Test 4] 空值与非法输入容错");
assert.strictEqual(formatDate(null), "-", "null 应输出 -");
assert.strictEqual(formatDateTime(undefined), "-", "undefined 应输出 -");
assert.strictEqual(formatShortDateTime("invalid-date"), "-", "非法日期应输出 -");
assert.strictEqual(formatTime(null), "-", "null 应输出 -");
assert.strictEqual(formatISODate("invalid"), "", "非法日期 formatISODate 应输出空串");
console.log("  ✔ 容错测试通过");

console.log("\n🎉 全部北京时间格式化与时区一致性测试 100% 通过！");
