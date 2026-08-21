import assert from "node:assert/strict";
import { Invariants } from "../src/lib/invariants";

console.log("🦀 启动阳澄大闸蟹溯源系统 —— 五大数量守恒与卡控规则自动化单元测试...\n");

// 1. 卡口一：入池额度校验
{
  console.log("▶ [Test 1] 养殖户年度额度与批次创建校验");
  // 正常入池
  const normal = Invariants.checkQuota({
    annualQuota: 60000,
    cumulativeInPool: 20000,
    newBatchCount: 10000,
  });
  assert.equal(normal.valid, true, "累计30000 <= 60000 应该通过");

  // 超额入池拦截
  const over = Invariants.checkQuota({
    annualQuota: 60000,
    cumulativeInPool: 55000,
    newBatchCount: 10000,
  });
  assert.equal(over.valid, false, "累计65000 > 60000 应该被拦截");
  assert.equal(over.excess, 5000, "超出额度应为 5000");
  console.log("  ✔ 额度入池硬上限拦截测试通过");
}

// 2. 卡口一：暂养池在养规格锁定与混池拦截
{
  console.log("▶ [Test 2] 暂养池同规格复用与不同规格混池拦截");
  // 空池入池自动绑定
  const emptyPool = Invariants.checkPoolSpec(
    { currentGender: null, currentWeightTier: null, activeCount: 0 },
    { gender: "MALE", weightTier: "4.0两" }
  );
  assert.equal(emptyPool.valid, true);
  assert.equal(emptyPool.requiresBinding, true, "空池应触发规格锁定");

  // 同规格复用入池
  const sameSpec = Invariants.checkPoolSpec(
    { currentGender: "MALE", currentWeightTier: "4.0两", activeCount: 500 },
    { gender: "MALE", weightTier: "4.0两" }
  );
  assert.equal(sameSpec.valid, true, "同公母同重量应允许复用入池");

  // 不同公母混池拦截
  const diffGender = Invariants.checkPoolSpec(
    { currentGender: "MALE", currentWeightTier: "4.0两", activeCount: 500 },
    { gender: "FEMALE", weightTier: "4.0两" }
  );
  assert.equal(diffGender.valid, false, "公母不同严禁混池");

  // 不同重量规格混池拦截
  const diffWeight = Invariants.checkPoolSpec(
    { currentGender: "MALE", currentWeightTier: "4.0两", activeCount: 500 },
    { gender: "MALE", weightTier: "3.0两" }
  );
  assert.equal(diffWeight.valid, false, "重量规格不同严禁混池");
  console.log("  ✔ 暂养池按规格复用与防混池拦截测试通过");
}

// 3. 卡口二：蟹扣领用余量动态卡控
{
  console.log("▶ [Test 3] 蟹扣可领余量与在池存活校验");
  // 正常领扣
  const validClaim = Invariants.checkTagClaim({
    farmerQuota: 60000,
    cumulativeClaimed: 10000,
    activeInPoolCount: 5000,
    requestedCount: 3000,
  });
  assert.equal(validClaim.valid, true);

  // 申请数超过在池存活
  const overPool = Invariants.checkTagClaim({
    farmerQuota: 60000,
    cumulativeClaimed: 10000,
    activeInPoolCount: 2000,
    requestedCount: 3000,
  });
  assert.equal(overPool.valid, false, "领扣数超过名下在池存活应被拦截");

  // 申请数超过年度剩余额度
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
  // 负损耗拦截 (实盘 > 账面)
  const negLoss = Invariants.calculateLoss({
    bookInPool: 1000,
    physicalCount: 1050,
    inPoolCount: 1000,
    historicalLoss: 0,
  });
  assert.equal(negLoss.valid, false, "实盘多于账面必须拦截，禁止负损耗");

  // 正常损耗 <= 5%
  const normalLoss = Invariants.calculateLoss({
    bookInPool: 1000,
    physicalCount: 970,
    inPoolCount: 1000,
    historicalLoss: 0,
  });
  assert.equal(normalLoss.valid, true);
  assert.equal(normalLoss.isException, false, "损耗率 3% 不应触发异常标记");

  // 损耗 > 5% 触发异常红线
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

// 5. 卡口四：出库审批在池存活与订单一致性强校验
{
  console.log("▶ [Test 5] 出库审批在池存活校验与单票一致性");
  // 正常出库
  const validOut = Invariants.checkOutbound({
    bookInPool: 2000,
    outboundCount: 500,
    channelOrderCount: 500,
  });
  assert.equal(validOut.valid, true);

  // 超发出库拦截
  const overOut = Invariants.checkOutbound({
    bookInPool: 300,
    outboundCount: 500,
    channelOrderCount: 500,
  });
  assert.equal(overOut.valid, false, "出库数超过批次在池存活应直接拦截");

  // 单票数量不一致拦截
  const mismatch = Invariants.checkOutbound({
    bookInPool: 2000,
    outboundCount: 500,
    channelOrderCount: 600,
  });
  assert.equal(mismatch.valid, false, "出库数与订单数不相等应拦截");
  console.log("  ✔ 出库审批三方一致性校验测试通过");
}

// 6. 卡口五：蟹扣日清日结轧平
{
  console.log("▶ [Test 6] 蟹扣日清日结轧平守恒");
  const balanced = Invariants.checkDailyBalance({
    claimedCount: 1000,
    boundCount: 800,
    returnedCount: 150,
    scrappedCount: 50,
  });
  assert.equal(balanced.isBalanced, true, "800 + 150 + 50 == 1000 应轧平");

  const unBalanced = Invariants.checkDailyBalance({
    claimedCount: 1000,
    boundCount: 800,
    returnedCount: 100,
    scrappedCount: 0,
  });
  assert.equal(unBalanced.isBalanced, false, "800 + 100 != 1000 应判定未轧平");
  console.log("  ✔ 蟹扣日清日结对账守恒测试通过\n");
}

console.log("🎉 全部 6 项核心数学卡控规则测试 100% 通过！");
