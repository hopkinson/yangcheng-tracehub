import assert from "node:assert/strict";

function calculateFarmerStats(farmer: {
  quota: number;
  cumulativeInPool: number;
  cumulativeClaimed: number;
  cumulativeBound: number;
}) {
  const remainingQuota = Math.max(0, farmer.quota - farmer.cumulativeBound);
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
    5670,
    "remainingQuota must be quota(6000) - bound(330) = 5670 (年度蟹扣余额结余)"
  );
  console.log("✔ farmer remainingQuota (总额度 - 累计绑扎数 = 5670) regression test passed");
}

runTest();
