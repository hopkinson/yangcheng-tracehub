import assert from "node:assert/strict";

function calculateFarmerStats(farmer: {
  quota: number;
  cumulativeInPool: number;
  cumulativeClaimed: number;
  cumulativeBound: number;
}) {
  const remainingQuota = Math.max(0, farmer.quota - farmer.cumulativeInPool);
  return { remainingQuota };
}

async function runTest() {
  const mockFarmer = {
    quota: 6000,
    cumulativeInPool: 340,
    cumulativeClaimed: 330,
    cumulativeBound: 330,
  };

  const result = calculateFarmerStats(mockFarmer);
  assert.equal(
    result.remainingQuota,
    5660,
    "remainingQuota must be quota(6000) - inPool(340) = 5660 (年度额度结余)"
  );
  console.log("✔ farmer remainingQuota (年度额度 - 累计入池数 = 5660) regression test passed");
}

runTest();
