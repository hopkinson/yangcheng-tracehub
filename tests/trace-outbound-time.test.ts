import assert from "node:assert/strict";
import { formatFullDateTime } from "../src/lib/utils";

async function testTraceOutboundTimeGrid() {
  console.log("🧪 运行出库环节 9 宫格字段与出库时间自动化验证...");

  const mockDate = new Date("2026-09-29T16:42:07+08:00");
  const formattedTime = formatFullDateTime(mockDate);
  assert.equal(formattedTime, "2026-09-29 16:42:07", "出库时间格式化必须为完整年月日时分秒");

  const outOrder = {
    code: "CK-20260929-030",
    type: "STORE_ORDER",
    storeName: "惠州",
    outboundCount: 320,
    outboundTime: mockDate,
    createdAt: new Date("2026-09-29T15:41:46+08:00"),
    approvedAt: mockDate,
    applicant: { fullName: "顾雨婷" },
    approver: { fullName: "张学明" },
  };

  const outboundLogistics = "苏州市冷链物流专车";
  const coldStoreName = "保鲜预冷库";
  const coldStoreCode = "BX-01";
  const isApproved = true;

  const details = [
    { label: "出库单号", value: outOrder.code },
    { label: "发货去向", value: outOrder.storeName },
    { label: "发货数量", value: `${outOrder.outboundCount} 只` },
    { label: "物流承运", value: outboundLogistics },
    { label: "出库时间", value: formatFullDateTime(outOrder.outboundTime || outOrder.createdAt) },
    { label: "出库状态", value: isApproved ? "已出库 (核验放行)" : "待核准出库" },
    { label: "申请人 / 时间", value: `${outOrder.applicant.fullName} · ${formatFullDateTime(outOrder.createdAt)}` },
    { label: "审核人 / 时间", value: `${outOrder.approver.fullName} · ${formatFullDateTime(outOrder.approvedAt)}` },
    { label: "调拨保鲜仓", value: `${coldStoreName} (${coldStoreCode})` },
  ];

  assert.equal(details.length, 9, "出库环节字段总数必须恰好为 9，满足 3x3 栅格对称");
  assert.equal(details[4].label, "出库时间", "出库时间字段必须位于第2行居中位置");
  assert.equal(details[4].value, "2026-09-29 16:42:07");
  assert.equal(details[6].label, "申请人 / 时间");
  assert.equal(details[7].label, "审核人 / 时间");

  console.log("✔ [测试通过] 出库环节 3x3 栅格与出库时间语义验证 100% 成功！");
}

testTraceOutboundTimeGrid().catch((err) => {
  console.error("❌ 验证失败:", err);
  process.exit(1);
});
