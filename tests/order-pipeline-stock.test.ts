import assert from "node:assert/strict";
import { Invariants } from "../src/lib/invariants";

/**
 * 单元测试：订单发货需求全链路工序（暂养、捆扎、分拣、保鲜）协同盘点
 */

import { aggregatePipelineStocks } from "../src/lib/order-stock";

// 模拟场景测试：
// 模拟需求：母蟹 2.5两 需 100 只
// 暂养池中已无母蟹 2.5两（起池进入后道工序），池内活蟹 = 0
// 捆扎中有 30 只，分拣合格待入库 20 只，保鲜冷库已有 70 只
// 旧逻辑：liveStock = 0 -> 缺口 100 只（虚假告警）
// 新逻辑：holding=0, bundling=30, sorting=20, cold=70, total=120 >= 100 -> 可满足！
console.log("🦀 启动发货全链路工序协同盘点测试...\n");

const batches = [
  { id: "B1", status: "PARTIALLY_OUTBOUND" },
];
const batchItems = [
  { id: "BI1", batchId: "B1", gender: "FEMALE", weightTier: "2.5两", inPoolCount: 120, outPoolCount: 120, lossCount: 0 },
];
const bundleBatches = [
  { id: "BB1", status: "BUNDLING", lines: [{ gender: "FEMALE", weightTier: "2.5两", count: 30 }] },
];
const sortTasks = [
  { id: "ST1", bundleBatchId: "BB_DONE", gender: "FEMALE", weightTier: "2.5两", inputCount: 90, qualifiedCount: 90 },
];
const coldLogs = [
  { id: "CL1", type: "INTAKE", sortTaskId: "ST1", count: 70 }, // 90中70已入冷库，20在分拣待入库
];
const outboundLines: any[] = [];
const outboundLosses: any[] = [];

const stocks = aggregatePipelineStocks({
  batches,
  batchItems,
  bundleBatches,
  sortTasks,
  coldLogs,
  outboundLines,
  outboundLosses,
});

const stock25F = stocks["FEMALE_2.5两"];
console.log("母蟹 2.5两 盘点结果:", stock25F);

assert.equal(stock25F.holding, 0, "暂养池在池存活应为 0");
assert.equal(stock25F.bundling, 30, "捆扎中应为 30");
assert.equal(stock25F.sorting, 20, "分拣待入冷库应为 20");
assert.equal(stock25F.cold, 70, "保鲜冷库在库应为 70");
assert.equal(stock25F.total, 120, "全链供给总存量应为 120 (0+30+20+70)");

// 对比需求 100 只
const needed = 100;
const gap = needed > stock25F.total ? needed - stock25F.total : 0;
assert.equal(gap, 0, "全链存量 120 >= 待发需求 100，不应触发缺口！");

console.log("✔ 协同全链路工序盘点验证 100% 通过，成功根治虚假缺口误报！");
