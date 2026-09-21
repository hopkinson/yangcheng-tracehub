import assert from "node:assert/strict";
import { Invariants } from "../src/lib/invariants";

async function testTagBreakdown() {
  console.log("=== Testing Invariants.getClaimDownstreamMetrics (1180 = 1100 outbound + 80 loss) ===");

  const mockClaim = {
    boundCount: 1180,
    bundleBatches: [
      {
        sortTasks: [
          {
            lossCount: 50, // 50 只死于分拣机分拣
            coldLogs: [
              {
                outboundLines: [{ count: 600 }, { count: 500 }], // 600 + 500 = 1100 出库
                outboundLosses: [{ count: 30 }], // 30 只发货出库损耗
              },
            ],
          },
        ],
      },
    ],
  };

  const res = Invariants.getClaimDownstreamMetrics(mockClaim);
  console.log("Calculated breakdown result:", res);

  assert.equal(res.outboundCount, 1100, "最终合规出库应为 1100 只");
  assert.equal(res.sortingLoss, 50, "分拣损耗应为 50 只");
  assert.equal(res.outboundLoss, 30, "出库损耗应为 30 只");
  assert.equal(res.totalDownstreamLoss, 80, "后道总损耗应为 80 只 (50+30)");
  assert.equal(res.inColdStorage, 0, "冷库结存为 0");
  assert.equal(res.outboundCount + res.totalDownstreamLoss, 1180, "1100出库 + 80损耗 == 1180 绑扣总数轧平");

  console.log("🎉 Invariants.getClaimDownstreamMetrics test passed!");
}

testTagBreakdown().catch((err) => {
  console.error(err);
  process.exit(1);
});
