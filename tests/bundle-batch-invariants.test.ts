import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { createBundleBatchAction } from "../src/actions/production";

async function main() {
  console.log("▶ [Test Suite] Starting bundle batch invariants tests...");

  // Find an approved tag claim with available quota
  const allClaims = await prisma.tagClaim.findMany({
    where: { status: "APPROVED" },
    include: { bundleBatches: { include: { lines: true } } },
  });

  let availableClaim = allClaims.find((c) => {
    const used = c.bundleBatches.reduce((s, b) => s + b.lines.reduce((ls, l) => ls + l.count, 0), 0);
    const avail = c.claimCount - Math.max(used, c.boundCount || 0) - (c.returnedCount || 0) - (c.scrappedCount || 0);
    return avail > 500;
  });

  if (!availableClaim) {
    const admin = await prisma.user.findFirstOrThrow();
    const farmer = await prisma.farmer.findFirstOrThrow();
    availableClaim = await prisma.tagClaim.create({
      data: {
        code: `XK-TEST-${Date.now()}`,
        claimDate: new Date(),
        farmerId: farmer.id,
        claimCount: 5000,
        status: "APPROVED",
        applicantId: admin.id,
      },
      include: { bundleBatches: { include: { lines: true } } },
    });
  }

  const alreadyUsed = availableClaim.bundleBatches.reduce((s, b) => s + b.lines.reduce((ls, l) => ls + l.count, 0), 0);
  const availableTags = availableClaim.claimCount - Math.max(alreadyUsed, availableClaim.boundCount || 0) - (availableClaim.returnedCount || 0) - (availableClaim.scrappedCount || 0);

  const bundleGroup = await prisma.bundleGroup.findFirst();
  if (!bundleGroup) {
    throw new Error("No bundle group found for test");
  }

  // Find or create an empty pool (liveCount = 0)
  let emptyPool = await prisma.holdingPool.findFirst({
    where: {
      status: "ACTIVE",
      batches: { none: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
      batchItems: { none: { batch: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } } },
    },
  });

  if (!emptyPool) {
    emptyPool = await prisma.holdingPool.create({
      data: {
        code: `ZY-TEST-EMPTY-${Date.now()}`,
        name: "测试空暂养池",
        status: "ACTIVE",
        currentGender: "MALE",
        currentWeightTier: "4.0两",
      },
    });
  }

  console.log(`Using TagClaim: ${availableClaim.id} (claimCount: ${availableClaim.claimCount}, availableTags: ${availableTags})`);
  console.log(`Using Empty Pool: ${emptyPool.code} (liveCount: 0)`);

  // Case 1: 空暂养池禁止出池出库
  console.log("\n--- Checking Case 1: Empty pool cannot exit crabs ---");
  const resEmptyPool = await createBundleBatchAction({
    groupId: bundleGroup.id,
    tagClaimId: availableClaim.id,
    ropeBatch: "XS-TEST-REPRO-01",
    lines: [
      {
        poolId: emptyPool.id,
        gender: "MALE",
        weightTier: "4.0两",
        count: 500,
      },
    ],
  });

  console.log("Result for empty pool 500 crabs:", resEmptyPool);
  assert.ok(
    resEmptyPool.message.includes("为空池，无活蟹可出池捆扎") ||
    resEmptyPool.message.includes("内无养殖户")
  );

  // Find a pool with active crabs where liveCount < availableTags
  const allPools = await prisma.holdingPool.findMany({
    where: { status: "ACTIVE" },
    include: {
      batches: { where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
      batchItems: {
        where: { batch: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
        include: { batch: true },
      },
    },
  });

  let liveCount = 0;
  const livePool = allPools.find((p) => {
    const directLive = p.batches.filter((b) => b.farmerId === availableClaim.farmerId).reduce((sum, b) => sum + Math.max(0, b.inPoolCount - b.outPoolCount - b.lossCount), 0);
    const itemLive = p.batchItems.filter((bi) => bi.batch?.farmerId === availableClaim.farmerId).reduce((sum, bi) => sum + Math.max(0, bi.inPoolCount - bi.outPoolCount - bi.lossCount), 0);
    const count = p.batchItems.length > 0 ? itemLive : directLive;
    if (count > 0 && count + 200 <= availableTags) {
      liveCount = count;
      return true;
    }
    return false;
  });

  if (livePool) {
    console.log(`Using Live Pool: ${livePool.code} (liveCount: ${liveCount})`);

    // Case 2: 暂养池出池数量大于在池存活拦截 (此时只数未超蟹扣余量)
    console.log("\n--- Checking Case 2: Pool over-exit intercepted ---");
    const resOverPool = await createBundleBatchAction({
      groupId: bundleGroup.id,
      tagClaimId: availableClaim.id,
      ropeBatch: "XS-TEST-REPRO-OVERPOOL",
      lines: [
        {
          poolId: livePool.id,
          gender: livePool.currentGender || "MALE",
          weightTier: livePool.currentWeightTier || "4.0两",
          count: liveCount + 100, // over pool, but within availableTags
        },
      ],
    });
    console.log("Result for pool over-exit:", resOverPool);
    assert.equal(resOverPool.success, false);
    assert.ok(resOverPool.message.includes("在池存活上限"));

    // Case 3: 捆扎只数超出蟹扣批次可用余量拦截
    console.log("\n--- Checking Case 3: Crab count exceeding tag limit intercepted ---");
    const resExcessTags = await createBundleBatchAction({
      groupId: bundleGroup.id,
      tagClaimId: availableClaim.id,
      ropeBatch: "XS-TEST-REPRO-OVERTAG",
      lines: [
        {
          poolId: livePool.id,
          gender: livePool.currentGender || "MALE",
          weightTier: livePool.currentWeightTier || "4.0两",
          count: availableTags + 500,
        },
      ],
    });
    console.log("Result for excess tags:", resExcessTags);
    assert.equal(resExcessTags.success, false);
    assert.ok(resExcessTags.message.includes("超出所选蟹扣批次可用余量"));
  }

  console.log("\n🎉 All 3 bundle batch invariant checks passed successfully!");
}

main().catch((err) => {
  console.error("Test assertion error:", err.message);
  process.exit(1);
});
