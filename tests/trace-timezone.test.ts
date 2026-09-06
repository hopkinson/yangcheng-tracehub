import assert from "node:assert/strict";
import { formatDateTime, formatDate, formatTime } from "../src/lib/utils";

// 验证无论环境 TZ 设为何值，格式化结果均严格锁定为东八区北京时间 (Asia/Shanghai)
async function runTimezoneTests() {
  console.log("🕒 启动时间与时区格式化回归测试...\n");

  // 模拟输入 UTC 时间：2026-09-06T13:22:56.000Z
  // 在东八区（UTC+8 北京时间），该时间必须显示为 21:22:56
  const testUtcDate = new Date("2026-09-06T13:22:56.000Z");

  console.log("▶ [Test 1] 校验基础工具函数的东八区时间转换");
  const beijingTimeStr = formatDateTime(testUtcDate, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  console.log("  格式化结果:", beijingTimeStr);
  assert.ok(
    beijingTimeStr.includes("21:22:56"),
    `应正确转换为北京时间 21:22:56，实际得到: ${beijingTimeStr}`
  );
  assert.ok(
    !beijingTimeStr.includes("13:22:56"),
    `不得泄漏 UTC 13:22:56 时间`
  );

  console.log("\n▶ [Test 2] 校验 resolveTraceQuery 输出链路节点时间锁定时区");
  const { resolveTraceQuery } = await import("../src/lib/trace-service");
  const res = await resolveTraceQuery("CK2026092101");
  assert.ok(res, "应能查出 CK2026092101");

  const rawNode = res.lines[0].chain.find((n) => n.stageName === "原料");
  assert.ok(rawNode, "必须包含原料节点");
  const inPoolDetail = rawNode.details.find((d) => d.label === "入池时间");
  assert.ok(inPoolDetail, "原料节点必须包含入池时间");
  console.log("  入池时间显示值:", inPoolDetail.value);

  // CK2026092101 对应的 batch inPoolTime 是 2026-09-20T07:00:00.000Z
  // 在东八区应为 15:00:00，在 UTC 下则为 07:00:00
  assert.ok(
    inPoolDetail.value.includes("15:00"),
    `入池时间必须为东八区 15:00:00，实际得到: ${inPoolDetail.value}`
  );
  assert.ok(
    !inPoolDetail.value.includes("07:00:00"),
    `不得显示为 UTC 07:00:00`
  );

  const outboundNode = res.lines[0].chain.find((n) => n.stageName === "出库");
  assert.ok(outboundNode, "必须包含出库节点");
  const approveDetail = outboundNode.details.find((d) => d.label === "审核人 / 时间");
  assert.ok(approveDetail, "出库节点必须包含审核时间");
  console.log("  审核时间显示值:", approveDetail.value);

  // approvedAt 为 2026-09-21T10:00:00.000Z，在东八区必须为 18:00:00
  assert.ok(
    approveDetail.value.includes("18:00"),
    `审核时间必须为东八区 18:00:00，实际得到: ${approveDetail.value}`
  );
  assert.ok(
    !approveDetail.value.includes("10:00:00"),
    `不得显示为 UTC 10:00:00`
  );

  console.log("\n🎉 时间与时区测试通过！");
}

runTimezoneTests().catch((err) => {
  console.error("❌ 测试失败:", err);
  process.exit(1);
});
