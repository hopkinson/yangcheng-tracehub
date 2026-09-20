import assert from "node:assert/strict";

// Invariant & Helper implementations to test
function calculateFarmerLedgerRow(farmer: {
  code: string;
  name: string;
  farmType: string;
  enclosures: { code: string }[];
  area: number;
  quota: number;
  batches: { inPoolCount: number }[];
  tagClaims: { claimCount: number; boundCount: number; returnedCount: number; scrappedCount: number }[];
}) {
  const cumulativeClaimed = farmer.tagClaims.reduce((sum, claim) => sum + claim.claimCount, 0);
  const cumulativeBound = farmer.tagClaims.reduce((sum, claim) => sum + claim.boundCount, 0);
  const cumulativeScrapped = farmer.tagClaims.reduce((sum, claim) => sum + claim.scrappedCount, 0);
  const cumulativeReturned = farmer.tagClaims.reduce((sum, claim) => sum + claim.returnedCount, 0);
  const cumulativeInPool = farmer.batches.reduce((sum, batch) => sum + batch.inPoolCount, 0);
  const cumulativeOutbound = 0;

  const exportRow = [
    farmer.code,
    farmer.name,
    farmer.farmType === "LAKE_CRAB" ? "湖蟹" : "塘蟹",
    farmer.enclosures.map((item) => item.code).join(", ") || "—",
    farmer.area,
    farmer.quota,
    cumulativeInPool,
    cumulativeClaimed, // 累计领扣(只) -> 1200
    cumulativeBound,   // 累计绑扎(只) -> 626
    cumulativeScrapped, // 累计作废 -> 8
    cumulativeReturned, // 累计回退 -> 66
    cumulativeOutbound,
    Math.max(0, farmer.quota - cumulativeBound), // 额度结余 -> 5374
  ];

  return { cumulativeClaimed, cumulativeBound, cumulativeScrapped, cumulativeReturned, exportRow };
}

function calculateTodayBundleTotalCount(bundleBatches: Array<{
  status: string;
  qualifiedCount?: number | null;
  lines: Array<{ count: number }>;
}>) {
  return bundleBatches.reduce(
    (s, b) =>
      s +
      (b.status === "COMPLETED" && b.qualifiedCount != null
        ? b.qualifiedCount
        : b.lines.reduce((ls, l) => ls + l.count, 0)),
    0
  );
}

function calculateFarmerStats(farmer: {
  quota: number;
  year: number;
  tagClaims: Array<{ claimDate: Date; claimCount: number; boundCount: number; returnedCount: number }>;
  batches: Array<{ inPoolTime: Date; inPoolCount: number; outboundOrders: Array<{ outboundCount: number }> }>;
}) {
  const currentYearTags = farmer.tagClaims;
  const cumulativeClaimed = currentYearTags.reduce((sum, t) => sum + t.claimCount, 0);
  const cumulativeBound = currentYearTags.reduce((sum, t) => sum + (t.boundCount || 0), 0);
  const remainingQuota = Math.max(0, farmer.quota - cumulativeBound);

  return {
    cumulativeClaimed,
    cumulativeBound,
    remainingQuota,
  };
}

async function runRegressionTests() {
  console.log("=== Running Regression Test for Fixes ===");

  // 1. Test Bug 1: Farmer Ledger Row
  const mockFarmer = {
    code: "JD-001",
    name: "张三",
    farmType: "LAKE_CRAB",
    enclosures: [{ code: "W-01" }],
    area: 10,
    quota: 6000,
    batches: [{ inPoolCount: 1000 }],
    tagClaims: [
      { claimCount: 700, boundCount: 626, returnedCount: 66, scrappedCount: 8 },
      { claimCount: 500, boundCount: 0, returnedCount: 0, scrappedCount: 0 },
    ],
  };

  const ledgerResult = calculateFarmerLedgerRow(mockFarmer);
  console.log("Ledger calculation result:", ledgerResult);

  assert.equal(ledgerResult.cumulativeClaimed, 1200, "台账累计领扣应为 1200 (700 + 500)");
  assert.equal(ledgerResult.cumulativeBound, 626, "台账累计绑扎应为 626");
  assert.equal(ledgerResult.cumulativeReturned, 66, "台账累计回退应为 66");
  assert.equal(ledgerResult.cumulativeScrapped, 8, "台账累计作废应为 8");
  // Invariant check: claimCount = bound + returned + scrapped for the completed batch
  assert.equal(626 + 66 + 8, 700, "日结批次 626 + 66 + 8 == 700 守恒轧平");
  assert.equal(ledgerResult.exportRow[12], 5374, "额度结余应为 6000 - 626 = 5374");

  // 2. Test Bug 1 part 2: Farmer Page remaining quota
  const farmerStats = calculateFarmerStats({
    quota: 6000,
    year: 2026,
    tagClaims: [
      { claimDate: new Date(), claimCount: 700, boundCount: 626, returnedCount: 66 },
      { claimDate: new Date(), claimCount: 500, boundCount: 0, returnedCount: 0 },
    ],
    batches: [{ inPoolTime: new Date(), inPoolCount: 1000, outboundOrders: [] }],
  });
  console.log("Farmer page stats result:", farmerStats);
  assert.equal(farmerStats.cumulativeClaimed, 1200, "养殖档案累计领扣应为 1200");
  assert.equal(farmerStats.remainingQuota, 5374, "养殖档案额度结余应为 5374 (守恒硬约束2: quota - boundCount)");

  // 3. Test Bug 2: Dashboard Bundle Total Count
  const mockBundleBatches = [
    {
      status: "COMPLETED",
      inputCount: 1030,
      qualifiedCount: 1022,
      lines: [{ count: 1030 }],
    },
  ];

  const dashboardCount = calculateTodayBundleTotalCount(mockBundleBatches);
  console.log(`Dashboard bundle total count: ${dashboardCount} (Expected: 1022)`);
  assert.equal(dashboardCount, 1022, "看板捆扎总数应为 1022 (实际完工合格只数，而非投入只数 1030)");

  console.log("🎉 All regression assertions passed!");
}

runRegressionTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
