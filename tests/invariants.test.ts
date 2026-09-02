import assert from "node:assert/strict";
import { Invariants } from "../src/lib/invariants";

console.log("🦀 启动阳澄大闸蟹溯源系统 —— PRD V2.1 数量闭环与卡控规则自动化单元测试...\n");

// 1. 卡口一：入池额度校验
{
  console.log("▶ [Test 1] 养殖户年度额度与批次创建校验");
  const normal = Invariants.checkQuota({
    annualQuota: 60000,
    cumulativeInPool: 20000,
    newBatchCount: 10000,
  });
  assert.equal(normal.valid, true, "累计30000 <= 60000 应该通过");

  const over = Invariants.checkQuota({
    annualQuota: 60000,
    cumulativeInPool: 55000,
    newBatchCount: 10000,
  });
  assert.equal(over.valid, false, "累计65000 > 60000 应该被拦截");
  assert.equal(over.excess, 5000, "超出额度应为 5000");
  console.log("  ✔ 额度入池硬上限拦截测试通过");
}

// 2. 卡口一：暂养池空池入池与已有在养存量混池拦截
{
  console.log("▶ [Test 2] 暂养池空池入池与已有在养存量混池拦截");
  const emptyPool = Invariants.checkPoolSpec(
    { currentGender: null, currentWeightTier: null, activeCount: 0 },
    { gender: "MALE", weightTier: "4.0两" }
  );
  assert.equal(emptyPool.valid, true);
  assert.equal(emptyPool.requiresBinding, true, "空池应允许入池并触发规格锁定");

  const occupiedPool = Invariants.checkPoolSpec(
    { currentGender: "MALE", currentWeightTier: "4.0两", activeCount: 500 },
    { gender: "MALE", weightTier: "4.0两" }
  );
  assert.equal(occupiedPool.valid, false, "已有在养存量时必须拦截，新批次只能选择空池");

  const diffGender = Invariants.checkPoolSpec(
    { currentGender: "MALE", currentWeightTier: "4.0两", activeCount: 500 },
    { gender: "FEMALE", weightTier: "4.0两" }
  );
  assert.equal(diffGender.valid, false, "异公母在养池严禁入池");

  const diffWeight = Invariants.checkPoolSpec(
    { currentGender: "MALE", currentWeightTier: "4.0两", activeCount: 500 },
    { gender: "MALE", weightTier: "3.0两" }
  );
  assert.equal(diffWeight.valid, false, "异规格在养池严禁入池");
  console.log("  ✔ 暂养池仅限空池入池与防混池拦截测试通过");
}

// 3. 卡口二：蟹扣领用余量动态卡控
{
  console.log("▶ [Test 3] 蟹扣可领余量与在池存活校验");
  const validClaim = Invariants.checkTagClaim({
    farmerQuota: 60000,
    cumulativeClaimed: 10000,
    activeInPoolCount: 5000,
    requestedCount: 3000,
  });
  assert.equal(validClaim.valid, true);

  const overPool = Invariants.checkTagClaim({
    farmerQuota: 60000,
    cumulativeClaimed: 10000,
    activeInPoolCount: 2000,
    requestedCount: 3000,
  });
  assert.equal(overPool.valid, false, "领扣数超过名下在池存活应被拦截");

  const overQuota = Invariants.checkTagClaim({
    farmerQuota: 12000,
    cumulativeClaimed: 10000,
    activeInPoolCount: 5000,
    requestedCount: 3000,
  });
  assert.equal(overQuota.valid, false, "领扣数超过年度剩余额度应被拦截");
  console.log("  ✔ 蟹扣余量双重约束测试通过");
}

// 4. 卡口三：盘点损耗与 5% 红线告警
{
  console.log("▶ [Test 4] 实盘登记、负损耗拦截与 5% 告警红线");
  const negLoss = Invariants.calculateLoss({
    bookInPool: 1000,
    physicalCount: 1050,
    inPoolCount: 1000,
    historicalLoss: 0,
  });
  assert.equal(negLoss.valid, false, "实盘多于账面必须拦截，禁止负损耗");

  const normalLoss = Invariants.calculateLoss({
    bookInPool: 1000,
    physicalCount: 970,
    inPoolCount: 1000,
    historicalLoss: 0,
  });
  assert.equal(normalLoss.valid, true);
  assert.equal(normalLoss.isException, false, "损耗率 3% 不应触发异常标记");

  const highLoss = Invariants.calculateLoss({
    bookInPool: 1000,
    physicalCount: 920,
    inPoolCount: 1000,
    historicalLoss: 0,
  });
  assert.equal(highLoss.valid, true);
  assert.equal(highLoss.isException, true, "损耗率 8% 必须标记异常");
  console.log("  ✔ 实盘登记与损耗品控风控规则测试通过");
}

// 5. 卡口四：冷库规格可出库存出库校验 (PRD V2.1)
{
  console.log("▶ [Test 5] 冷库规格库存校验与不足拦截");
  // 正常出库
  const validColdOut = Invariants.checkColdStorageOutbound({
    availableCount: 1000,
    requestedCount: 600,
    spec: "3.5两",
    gender: "FEMALE",
  });
  assert.equal(validColdOut.valid, true);
  assert.equal(validColdOut.remaining, 400);

  // 库存不足拦截
  const overColdOut = Invariants.checkColdStorageOutbound({
    availableCount: 0,
    requestedCount: 800,
    spec: "3.5两",
    gender: "FEMALE",
  });
  assert.equal(overColdOut.valid, false);
  assert.ok(overColdOut.reason.includes("母蟹 3.5两 冷库可出库库存不足：需 800 只，现仅 0 只"));
  console.log("  ✔ 冷库规格库存校验与拦截提示测试通过");
}

// 6. 分拣称重与损耗自动计算 (PRD V2.1)
{
  console.log("▶ [Test 6] 分拣称重损耗计算与超5%红线");
  // 正常分拣 445 -> 438, 损耗 7 只 (1.57%)
  const normalSort = Invariants.calculateSortingLoss({
    inputCount: 445,
    qualifiedCount: 438,
  });
  assert.equal(normalSort.valid, true);
  assert.equal(normalSort.lossCount, 7);
  assert.equal(normalSort.lossRate, 1.57);
  assert.equal(normalSort.isException, false);

  // 损耗超标分拣 1000 -> 920, 损耗 80 只 (8%)
  const highLossSort = Invariants.calculateSortingLoss({
    inputCount: 1000,
    qualifiedCount: 920,
  });
  assert.equal(highLossSort.valid, true);
  assert.equal(highLossSort.lossCount, 80);
  assert.equal(highLossSort.lossRate, 8.0);
  assert.equal(highLossSort.isException, true);
  console.log("  ✔ 分拣称重损耗与5%告警测试通过");
}

// 7. 蟹卡规格型号正则智能拆分 (PRD V2.1)
{
  console.log("▶ [Test 7] 蟹卡规格型号多明细行正则自动拆分");
  const rawModel = "4.0母蟹X5只，5.0公蟹X5只";
  const parsed = Invariants.parseCrabCardSpec(rawModel);
  assert.equal(parsed.length, 2, "应拆分为 2 条明细行");
  assert.deepEqual(parsed[0], { gender: "FEMALE", weightTier: "4.0两", count: 5 });
  assert.deepEqual(parsed[1], { gender: "MALE", weightTier: "5.0两", count: 5 });

  const rawModel2 = "3.5母*4, 4.0公*4";
  const parsed2 = Invariants.parseCrabCardSpec(rawModel2);
  assert.equal(parsed2.length, 2);
  assert.deepEqual(parsed2[0], { gender: "FEMALE", weightTier: "3.5两", count: 4 });
  assert.deepEqual(parsed2[1], { gender: "MALE", weightTier: "4.0两", count: 4 });
  console.log("  ✔ 蟹卡规格型号智能拆分测试通过");
}

// 8. 蟹扣逐日轧平对账
{
  console.log("▶ [Test 8] 蟹扣日清日结轧平守恒");
  const balanced = Invariants.checkDailyBalance({
    claimedCount: 1000,
    boundCount: 800,
    returnedCount: 150,
    scrappedCount: 50,
  });
  assert.equal(balanced.isBalanced, true, "800 + 150 + 50 == 1000 应轧平");
  console.log("  ✔ 蟹扣日清日结对账守恒测试通过\n");
}

console.log("🎉 全部 8 项 PRD V2.1 核心数学卡控规则测试 100% 通过！");
