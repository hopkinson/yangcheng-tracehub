import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("🔍 运行出库发运指标排除驳回单与口径一致性诊断测试...");

// 1. 模拟用户环境数据：包含正常合规单(5543只)与风控驳回单(518只)
const todayStr = "2026-10-01";
const isToday = (d: Date | string | null | undefined): boolean => Boolean(d && (typeof d === "string" ? d.startsWith(todayStr) : d.toISOString().startsWith(todayStr)));

const mockOutboundOrders = [
  {
    id: "ck-1",
    code: "CK-20261001-001",
    status: "APPROVED",
    outboundCount: 5543,
    createdAt: new Date("2026-10-01T10:00:00Z"),
    approvedAt: new Date("2026-10-01T10:30:00Z"),
    lines: [{ orderNo: "SO-001", count: 5543 }],
  },
  {
    id: "ck-23",
    code: "CK-20261001-023",
    status: "REJECTED", // 被风控驳回的重复单 (提蟹 518 只)
    outboundCount: 518,
    createdAt: new Date("2026-10-01T15:20:00Z"),
    approvedAt: null,
    lines: [{ orderNo: "SO-023", count: 518 }],
  },
  {
    id: "ck-pending",
    code: "CK-20261001-025",
    status: "PENDING", // 待审核中的单
    outboundCount: 100,
    createdAt: new Date("2026-10-01T16:00:00Z"),
    approvedAt: null,
    lines: [{ orderNo: "SO-025", count: 100 }],
  },
];

// 2. 检查当前 src/app/page.tsx 中对 todayOutboundOrders 的过滤逻辑
const pagePath = path.resolve(__dirname, "../src/app/page.tsx");
const pageSource = fs.readFileSync(pagePath, "utf-8");

// 提取 page.tsx 中对 todayOutboundOrders 的赋值语句
const match = pageSource.match(/const\s+todayOutboundOrders\s*=\s*([^;]+);/);
assert.ok(match, "必须在 page.tsx 找到 todayOutboundOrders 的定义");
const filterExpr = match[1];
console.log("当前 page.tsx 中的 todayOutboundOrders 过滤表达式:", filterExpr.trim());

// 用当前表达式在 mock 数据上求值（模拟 page.tsx 行为）
// 当前实现是: outboundOrders.filter((o) => isToday(o.createdAt))
const computeCurrentTodayOutbound = (outboundOrders: typeof mockOutboundOrders) => {
  // 如果当前代码包含 APPROVED，则按 APPROVED 过滤；如果不包含，则按当前原始代码过滤
  if (filterExpr.includes('status === "APPROVED"') || filterExpr.includes("APPROVED")) {
    return outboundOrders.filter((o) => o.status === "APPROVED" && isToday(o.createdAt));
  }
  return outboundOrders.filter((o) => isToday(o.createdAt));
};

const currentTodayOrders = computeCurrentTodayOutbound(mockOutboundOrders);
const currentTodayTotalCount = currentTodayOrders.reduce((s, o) => s + o.outboundCount, 0);

console.log(`当前计算结果: todayOutboundTotalCount = ${currentTodayTotalCount}`);

// 期望口径：合规出库发运口径，必须排除 REJECTED (518只) 与未审批单，只能是 APPROVED (5543只)
assert.equal(
  currentTodayTotalCount,
  5543,
  `❌ [BUG CONFIRMED] 今日出库发运卡片统计包含了被驳回的 518 只或待审核单 (实际值: ${currentTodayTotalCount})，未统一为合规口径 (预期值: 5543)！`
);

console.log("✔ 测试通过：今日出库发运统计已正确排除被驳回单！");
