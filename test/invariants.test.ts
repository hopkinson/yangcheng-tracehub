import assert from "node:assert";
import { Invariants } from "../src/lib/invariants";

console.log("🧪 运行五大数量守恒硬卡控断言测试...");

// 1. 额度校验
assert.strictEqual(Invariants.calculateQuota(100), 60000);
const quotaCheck1 = Invariants.checkQuota({ annualQuota: 60000, cumulativeInPool: 50000, newBatchCount: 5000 });
assert.strictEqual(quotaCheck1.valid, true);
assert.strictEqual(quotaCheck1.remainingQuota, 10000);

const quotaCheck2 = Invariants.checkQuota({ annualQuota: 60000, cumulativeInPool: 58000, newBatchCount: 3000 });
assert.strictEqual(quotaCheck2.valid, false);
assert.strictEqual(quotaCheck2.excess, 1000);

// 2. 暂养池规格复用与冲突
const poolOk = Invariants.checkPoolSpec(
  { currentGender: "MALE", currentWeightTier: "4.0两", activeCount: 1000 },
  { gender: "MALE", weightTier: "4.0两" }
);
assert.strictEqual(poolOk.valid, true);

const poolConflict = Invariants.checkPoolSpec(
  { currentGender: "MALE", currentWeightTier: "4.0两", activeCount: 1000 },
  { gender: "FEMALE", weightTier: "3.0两" }
);
assert.strictEqual(poolConflict.valid, false);

// 3. 蟹扣领用余量
const tagCheck = Invariants.checkTagClaim({
  farmerQuota: 60000,
  cumulativeClaimed: 20000,
  activeInPoolCount: 15000,
  requestedCount: 12000,
});
assert.strictEqual(tagCheck.valid, true);
assert.strictEqual(tagCheck.maxClaimable, 15000);

const tagOver = Invariants.checkTagClaim({
  farmerQuota: 60000,
  cumulativeClaimed: 20000,
  activeInPoolCount: 15000,
  requestedCount: 16000,
});
assert.strictEqual(tagOver.valid, false);

// 4. 损耗与 5% 阈值
const lossNormal = Invariants.calculateLoss({
  bookInPool: 1000,
  physicalCount: 980,
  inPoolCount: 1000,
  historicalLoss: 0,
});
assert.strictEqual(lossNormal.valid, true);
assert.strictEqual(lossNormal.lossDelta, 20);
assert.strictEqual(lossNormal.isException, false);

const lossNegative = Invariants.calculateLoss({
  bookInPool: 1000,
  physicalCount: 1050,
  inPoolCount: 1000,
  historicalLoss: 0,
});
assert.strictEqual(lossNegative.valid, false); // 严禁负损耗

const lossHigh = Invariants.calculateLoss({
  bookInPool: 1000,
  physicalCount: 900,
  inPoolCount: 1000,
  historicalLoss: 0,
});
assert.strictEqual(lossHigh.isException, true); // 10% > 5%

// 5. 单票出库校验
const outboundOk = Invariants.checkOutbound({ bookInPool: 500, outboundCount: 200, channelOrderCount: 200 });
assert.strictEqual(outboundOk.valid, true);

const outboundMismatch = Invariants.checkOutbound({ bookInPool: 500, outboundCount: 200, channelOrderCount: 180 });
assert.strictEqual(outboundMismatch.valid, false);

// 6. 蟹扣日结轧平
const balanced = Invariants.checkDailyBalance({ claimedCount: 1000, boundCount: 950, returnedCount: 30, scrappedCount: 20 });
assert.strictEqual(balanced.isBalanced, true);

const unbalanced = Invariants.checkDailyBalance({ claimedCount: 1000, boundCount: 900, returnedCount: 30, scrappedCount: 20 });
assert.strictEqual(unbalanced.isBalanced, false);
assert.strictEqual(unbalanced.diff, 50);

console.log("✅ 全部五大数量守恒核心卡控断言测试通过！");
