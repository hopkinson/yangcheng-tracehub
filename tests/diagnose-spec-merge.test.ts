import assert from "node:assert/strict";

/**
 * 诊断测试：规格库存中 "3.0两 母蟹" 与 "3两 母蟹" 未合并问题
 * 
 * 场景还原（来自用户截图）：
 * - 4.0两 公蟹 13只 占96%
 * - 3.5两 公蟹 0只
 * - 3.0两 母蟹 8只 占97%
 * - 3两 母蟹 5只
 * 预期："3.0两 母蟹" 与 "3两 母蟹" 为同一规格（3.0两），必须自动归一化合并，不得拆分为两张卡片展示。
 */

// 导入待测逻辑（包含在 invariants 或 outbound 聚合中）
import { Invariants } from "../src/lib/invariants";

function runDiagnostics() {
  console.log("================================================================================");
  console.log("🧪 运行诊断测试：重量档位规格归一化与合并 (3.0两 vs 3两)");
  console.log("================================================================================\n");

  // 1. 测试 normalizeWeightTier 纯函数
  // 检查 Invariants 是否已暴露 normalizeWeightTier
  if (typeof Invariants.normalizeWeightTier !== "function") {
    throw new Error("Invariants.normalizeWeightTier 函数不存在！规格归一化能力缺失。");
  }

  // @ts-ignore
  const normalize = Invariants.normalizeWeightTier;
  assert.equal(normalize("3两"), "3.0两", "3两 应标准化为 3.0两");
  assert.equal(normalize("3"), "3.0两", "3 应标准化为 3.0两");
  assert.equal(normalize("3.0两"), "3.0两", "3.0两 应保持 3.0两");
  assert.equal(normalize("3.0"), "3.0两", "3.0 应标准化为 3.0两");
  assert.equal(normalize("3.5两"), "3.5两", "3.5两 应保持 3.5两");
  assert.equal(normalize("3.5"), "3.5两", "3.5 应标准化为 3.5两");
  assert.equal(normalize("4两"), "4.0两", "4两 应标准化为 4.0两");
  assert.equal(normalize("4.0两"), "4.0两", "4.0两 应保持 4.0两");

  console.log("  ✔ Test 1 通过: 规格标准化格式正确统一为 X.X两\n");

  // 2. 模拟用户真实数据下的规格库存聚合
  console.log("▶ [Test 2] 模拟用户真实数据下的规格库存合并...");
  const sortTasks = [
    { gender: "MALE", weightTier: "4.0两", qualifiedCount: 325 },
    { gender: "FEMALE", weightTier: "3.0两", qualifiedCount: 308 },
    { gender: "FEMALE", weightTier: "3两", qualifiedCount: 5 }, // 录入/识别为 "3两"
  ];

  const outboundLines = [
    { gender: "MALE", weightTier: "4.0两", count: 312 }, // 325 - 312 = 13 (96%)
    { gender: "FEMALE", weightTier: "3.0两", count: 300 }, // 308 - 300 = 8
  ];

  // 按照聚合逻辑，母蟹 3.0两 与 3两 应该合并：
  // 合格总数 = 308 + 5 = 313
  // 已出库 = 300
  // 可出存量 = 313 - 300 = 13
  // 占用比例 = round(300 / 313 * 100) = 96%
  const aggregated = Invariants.aggregateSpecStocks({
    sortTasks,
    outboundLines,
  });

  const female3Specs = aggregated.filter((s: any) => s.gender === "FEMALE" && (s.weightTier === "3.0两" || s.weightTier === "3两"));
  assert.equal(female3Specs.length, 1, `母蟹 3两/3.0两 应合并为 1 项，实际却有 ${female3Specs.length} 项`);
  
  const female3 = female3Specs[0];
  assert.equal(female3.weightTier, "3.0两", "合并后规格应为标准 3.0两");
  assert.equal(female3.qualified, 313, `分拣合格数应合并为 313，实际为 ${female3.qualified}`);
  assert.equal(female3.used, 300, `已占用数应为 300，实际为 ${female3.used}`);
  assert.equal(female3.available, 13, `可出存量应为 13，实际为 ${female3.available}`);
  assert.equal(female3.usagePct, 96, `占用率应为 96%，实际为 ${female3.usagePct}`);

  console.log("  ✔ Test 2 通过: 规格库存成功合并，不再拆分展示\n");
}

runDiagnostics();
