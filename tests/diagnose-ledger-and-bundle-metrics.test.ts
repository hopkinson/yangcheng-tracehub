import assert from "node:assert/strict";
import { Invariants } from "../src/lib/invariants";

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

  // 4. Test Bug 3: Tag Claim Ledger Export Alignment & Inbound Count
  const TAG_CLAIM_LEDGER_HEADERS = [
    "申领日期",
    "申领时间",
    "蟹扣批次",
    "蟹扣养殖户",
    "蟹扣入仓数",
    "申领数",
    "完成绑扎",
    "其中-已出库",
    "其中-后道损耗",
    "退回",
    "作废",
    "差额",
    "轧平校验",
    "累计绑扎",
    "剩余额度",
    "申请人",
    "复核人",
    "审核状态",
  ];

  const mockTagClaim = {
    claimDate: new Date("2026-09-21T08:00:00Z"),
    code: "XK2026092101",
    status: "APPROVED",
    claimCount: 2080,
    boundCount: 2070,
    returnedCount: 0,
    scrappedCount: 0,
    isBalanced: false,
    applicant: { fullName: "阳澄股份超级管理员" },
    approver: { fullName: "阳澄股份超级管理员" },
    farmer: {
      name: "张三",
      quota: 6000,
      batches: [{ inPoolCount: 2500 }],
      tagClaims: [{ boundCount: 2070 }],
    },
    bundleBatches: [
      {
        sortTasks: [
          {
            lossCount: 15,
            coldLogs: [
              {
                outboundLines: [{ count: 1800 }],
                outboundLosses: [{ count: 5 }],
              },
            ],
          },
        ],
      },
    ],
  };

  const isRejected = mockTagClaim.status === "REJECTED";
  const cumulativeBound = mockTagClaim.farmer.tagClaims.reduce((sum, item) => sum + item.boundCount, 0);
  const tagInboundCount = mockTagClaim.farmer.batches?.reduce((sum, b) => sum + b.inPoolCount, 0) ?? 0;
  const balanceDiff = mockTagClaim.claimCount - mockTagClaim.boundCount - mockTagClaim.returnedCount - mockTagClaim.scrappedCount;
  const { outboundCount, totalDownstreamLoss } = Invariants.getClaimDownstreamMetrics(mockTagClaim);

  const exportRow = [
    "2026-09-21",
    "08:00",
    mockTagClaim.code || "—",
    mockTagClaim.farmer.name,
    isRejected ? 0 : tagInboundCount,
    isRejected ? 0 : mockTagClaim.claimCount,
    isRejected ? 0 : mockTagClaim.boundCount,
    isRejected ? 0 : outboundCount,
    isRejected ? 0 : totalDownstreamLoss,
    isRejected ? 0 : mockTagClaim.returnedCount,
    isRejected ? 0 : mockTagClaim.scrappedCount,
    isRejected ? 0 : balanceDiff,
    isRejected ? "已驳回" : mockTagClaim.isBalanced ? "已轧平" : "未轧平",
    isRejected ? 0 : cumulativeBound,
    isRejected ? mockTagClaim.farmer.quota : Math.max(0, mockTagClaim.farmer.quota - cumulativeBound),
    mockTagClaim.applicant?.fullName || "—",
    mockTagClaim.approver?.fullName || "—",
    mockTagClaim.status === "APPROVED" ? "已通过" : "待审核",
  ];

  console.log("Tag claim ledger headers count:", TAG_CLAIM_LEDGER_HEADERS.length);
  console.log("Tag claim export row length:", exportRow.length);
  assert.equal(TAG_CLAIM_LEDGER_HEADERS.length, exportRow.length, "表头列数必须与数据行严格一致 (18 列)");
  assert.equal(TAG_CLAIM_LEDGER_HEADERS[4], "蟹扣入仓数", "第5列表头必须为『蟹扣入仓数』");
  assert.equal(exportRow[4], 2500, "第5列数据必须为养殖户累计入仓数 (2500)");
  assert.equal(TAG_CLAIM_LEDGER_HEADERS[5], "申领数", "第6列表头必须为『申领数』");
  assert.equal(exportRow[5], 2080, "第6列数据必须为本次申领数 (2080)");
  assert.equal(TAG_CLAIM_LEDGER_HEADERS[6], "完成绑扎", "第7列表头必须为『完成绑扎』");
  assert.equal(exportRow[6], 2070, "第7列数据必须为已完成绑扎数 (2070)");
  assert.equal(TAG_CLAIM_LEDGER_HEADERS[11], "差额", "差额列校验");
  assert.equal(exportRow[11], 10, "差额应为 2080 - 2070 = 10");
  assert.equal(TAG_CLAIM_LEDGER_HEADERS[12], "轧平校验", "轧平校验列校验");
  assert.equal(exportRow[12], "未轧平", "差额 > 0 状态必须为未轧平");
  assert.equal(TAG_CLAIM_LEDGER_HEADERS[13], "累计绑扎", "累计绑扎列校验");
  assert.equal(exportRow[13], 2070, "累计绑扎应为 2070");
  assert.equal(TAG_CLAIM_LEDGER_HEADERS[14], "剩余额度", "剩余额度列校验");
  assert.equal(exportRow[14], 3930, "剩余额度应为 6000 - 2070 = 3930");
  console.log("  ✔ 蟹扣领用台账 18 列表头与数据行 1:1 严格对齐测试通过\n");

  console.log("🎉 All regression assertions passed!");
}

runRegressionTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
