import assert from "node:assert/strict";
import { Invariants } from "../src/lib/invariants";

async function runBoundaryValidationTests() {
  console.log("🧪 开始测试原料批次新建边界校验 (MultiSpecIntake Boundary Validation)...");

  const farmerRemainingQuota = 5370;

  console.log("▶ [Test 1] 只数填 0 必须有明确错误提示且禁止提交");
  {
    const items = [
      { poolId: "pool-1", gender: "MALE", weightTier: "4.0两", weight: 300, inPoolCount: 0 },
    ];
    const validation = Invariants.validateMultiSpecBatch(items, farmerRemainingQuota);
    assert.strictEqual(validation.canSubmit, false, "只数为 0 时必须禁止提交");
    assert.strictEqual(validation.hasErrors, true, "只数为 0 时必须标记有错误");
    assert.match(validation.itemErrors[0]?.countError || "", /大于 0|必须为正整数/, "只数为 0 必须返回明确错误提示");
  }

  console.log("▶ [Test 2] 只数填负数 (-5) 必须有明确错误提示且禁止提交");
  {
    const items = [
      { poolId: "pool-1", gender: "MALE", weightTier: "4.0两", weight: 300, inPoolCount: -5 },
    ];
    const validation = Invariants.validateMultiSpecBatch(items, farmerRemainingQuota);
    assert.strictEqual(validation.canSubmit, false, "只数为负数时必须禁止提交");
    assert.strictEqual(validation.hasErrors, true, "只数为负数时必须标记有错误");
    assert.match(validation.itemErrors[0]?.countError || "", /大于 0|必须为正整数/, "只数为负数必须返回明确错误提示");
  }

  console.log("▶ [Test 3] 重量填 0 或负数必须有明确错误提示且禁止提交");
  {
    const itemsZeroWeight = [
      { poolId: "pool-1", gender: "MALE", weightTier: "4.0两", weight: 0, inPoolCount: 100 },
    ];
    const valZero = Invariants.validateMultiSpecBatch(itemsZeroWeight, farmerRemainingQuota);
    assert.strictEqual(valZero.canSubmit, false, "重量为 0 时必须禁止提交");
    assert.match(valZero.itemErrors[0]?.weightError || "", /大于 0/, "重量为 0 必须提示大于 0");

    const itemsNegWeight = [
      { poolId: "pool-1", gender: "MALE", weightTier: "4.0两", weight: -10, inPoolCount: 100 },
    ];
    const valNeg = Invariants.validateMultiSpecBatch(itemsNegWeight, farmerRemainingQuota);
    assert.strictEqual(valNeg.canSubmit, false, "重量为负数时必须禁止提交");
    assert.match(valNeg.itemErrors[0]?.weightError || "", /大于 0/, "重量为负数必须提示大于 0");
  }

  console.log("▶ [Test 4] 只数填 99,999,999 远超养殖户余量 (5,370 只) 必须标记超额且禁止提交");
  {
    const items = [
      { poolId: "pool-1", gender: "MALE", weightTier: "4.0两", weight: 21212121, inPoolCount: 99999999 },
      { poolId: "pool-2", gender: "FEMALE", weightTier: "3.5两", weight: 380, inPoolCount: 1500 },
    ];
    const validation = Invariants.validateMultiSpecBatch(items, farmerRemainingQuota);
    assert.strictEqual(validation.canSubmit, false, "超额时必须禁止提交");
    assert.strictEqual(validation.isOverQuota, true, "必须标记 isOverQuota");
    assert.strictEqual(validation.totalCount, 100001499, "总数应计算正确");
    assert.strictEqual(validation.excessQuota, 100001499 - 5370, "超额数量计算正确");
    assert.match(validation.itemErrors[0]?.countError || validation.errorMessage || "", /超.*额度|5,?370/, "必须提示超出养殖户剩余额度");
  }

  console.log("▶ [Test 5] 正常合规数据校验通过允许提交");
  {
    const items = [
      { poolId: "pool-1", gender: "MALE", weightTier: "4.0两", weight: 450, inPoolCount: 1500 },
      { poolId: "pool-2", gender: "FEMALE", weightTier: "3.5两", weight: 380, inPoolCount: 1500 },
    ];
    const validation = Invariants.validateMultiSpecBatch(items, farmerRemainingQuota);
    assert.strictEqual(validation.canSubmit, true, "合规数据应允许提交");
    assert.strictEqual(validation.hasErrors, false, "合规数据不应有错误");
    assert.strictEqual(validation.isOverQuota, false, "合规数据不应超额");
    assert.strictEqual(validation.totalCount, 3000, "合计 3000 只");
  }

  console.log("🎉 所有边界校验测试通过！");
}

runBoundaryValidationTests().catch((err) => {
  console.error("❌ 测试失败:", err);
  process.exit(1);
});
