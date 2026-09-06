import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { createBundleBatchAction, deleteBundleBatchAction } from "../src/actions/production";
import { Invariants } from "../src/lib/invariants";

async function main() {
  console.log("▶ [Repro Test] Testing pool inventory deduction upon bundle batch creation...");

  // 1. Setup a test pool, farmer, batch, and tag claim
  const admin = await prisma.user.findFirstOrThrow();
  const farmer = await prisma.farmer.findFirstOrThrow();
  const enclosure = (await prisma.enclosure.findFirst({ where: { farmerId: farmer.id } })) || (await prisma.enclosure.create({
    data: {
      code: `WY-TEST-${Date.now()}`,
      farmerId: farmer.id,
      description: "测试围网",
    }
  }));

  const pool = await prisma.holdingPool.create({
    data: {
      code: `ZY-REPRO-${Date.now()}`,
      name: "测试暂养池-扣减库存",
      status: "ACTIVE",
      currentGender: "MALE",
      currentWeightTier: "4.0两",
    },
  });

  const batch = await prisma.batch.create({
    data: {
      code: `YL-REPRO-${Date.now()}`,
      farmerId: farmer.id,
      enclosureId: enclosure.id,
      poolId: pool.id,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolCount: 320,
      outPoolCount: 0,
      lossCount: 0,
      status: "TEMPORARY_HOLDING",
      createdById: admin.id,
      items: {
        create: [
          {
            poolId: pool.id,
            gender: "MALE",
            weightTier: "4.0两",
            inPoolCount: 320,
            outPoolCount: 0,
            lossCount: 0,
          }
        ]
      }
    },
    include: { items: true },
  });

  const tagClaim = await prisma.tagClaim.create({
    data: {
      code: `XK-REPRO-${Date.now()}`,
      claimDate: new Date(),
      farmerId: farmer.id,
      claimCount: 1000,
      status: "APPROVED",
      applicantId: admin.id,
    },
    include: { bundleBatches: { include: { lines: true } } },
  });

  let bundleGroup = await prisma.bundleGroup.findFirst();
  if (!bundleGroup) {
    bundleGroup = await prisma.bundleGroup.create({
      data: {
        code: `P-TEST-${Date.now()}`,
        name: "测试捆扎组",
      }
    });
  }

  try {
    // 2. Query initial live count of the pool
    const poolWithBatches = await prisma.holdingPool.findUniqueOrThrow({
      where: { id: pool.id },
      include: {
        batches: { where: { status: { not: "FROZEN" } } },
        batchItems: { where: { batch: { status: { not: "FROZEN" } } } },
      },
    });
    const initialLive = Invariants.calculatePoolLiveCount(poolWithBatches);
    console.log(`Initial pool live count: ${initialLive}`);
    assert.equal(initialLive, 320);

    // 3. Create a bundle batch for 320 crabs
    console.log("Creating bundle batch 1 for 320 crabs...");
    const createRes1 = await createBundleBatchAction({
      groupId: bundleGroup.id,
      tagClaimId: tagClaim.id,
      ropeBatch: "XS-REPRO-01",
      lines: [
        {
          poolId: pool.id,
          gender: "MALE",
          weightTier: "4.0两",
          count: 320,
        }
      ],
    });
    console.log("createRes1:", createRes1);
    assert.equal(createRes1.success, true);

    // 4. Query pool live count again right after creating bundle batch
    const poolAfterBundle1 = await prisma.holdingPool.findUniqueOrThrow({
      where: { id: pool.id },
      include: {
        batches: { where: { status: { not: "FROZEN" } } },
        batchItems: { where: { batch: { status: { not: "FROZEN" } } } },
      },
    });
    const liveAfterBundle1 = Invariants.calculatePoolLiveCount(poolAfterBundle1);
    console.log(`Pool live count after creating bundling batch: ${liveAfterBundle1}`);

    // BUG SYMPTOM: Currently this will FAIL because liveAfterBundle1 is still 320 instead of 0!
    assert.equal(
      liveAfterBundle1,
      0,
      `Expected pool live count to be 0 after bundling batch created, but got ${liveAfterBundle1}`
    );

    // 5. Trying to create a second bundle batch should be blocked because inventory was already deducted
    console.log("Attempting to create bundle batch 2 from same pool for 320 crabs...");
    const createRes2 = await createBundleBatchAction({
      groupId: bundleGroup.id,
      tagClaimId: tagClaim.id,
      ropeBatch: "XS-REPRO-02",
      lines: [
        {
          poolId: pool.id,
          gender: "MALE",
          weightTier: "4.0两",
          count: 320,
        }
      ],
    });
    console.log("createRes2:", createRes2);
    assert.equal(createRes2.success, false, "Second bundle batch should fail due to insufficient pool live count");

    // 6. Test cancellation / deletion: cancelling the bundling batch should restore pool inventory
    const createdBatch = await prisma.bundleBatch.findFirstOrThrow({
      where: { code: createRes1.code },
    });
    console.log("Cancelling/deleting bundle batch...");
    const deleteRes = await deleteBundleBatchAction(createdBatch.id);
    console.log("deleteRes:", deleteRes);
    assert.equal(deleteRes.success, true);

    const poolAfterDelete = await prisma.holdingPool.findUniqueOrThrow({
      where: { id: pool.id },
      include: {
        batches: { where: { status: { not: "FROZEN" } } },
        batchItems: { where: { batch: { status: { not: "FROZEN" } } } },
      },
    });
    const liveAfterDelete = Invariants.calculatePoolLiveCount(poolAfterDelete);
    console.log(`Pool live count after cancellation: ${liveAfterDelete}`);
    assert.equal(liveAfterDelete, 320, "Inventory should be restored to 320 after cancelling bundling batch");

    console.log("🎉 All assertions passed!");
  } finally {
    // Cleanup created test records
    await prisma.bundleBatch.deleteMany({
      where: { tagClaimId: tagClaim.id }
    });
    await prisma.tagClaim.delete({ where: { id: tagClaim.id } });
    await prisma.batchItem.deleteMany({ where: { batchId: batch.id } });
    await prisma.batch.delete({ where: { id: batch.id } });
    await prisma.holdingPool.delete({ where: { id: pool.id } });
  }
}

main().catch((err) => {
  console.error("❌ Test failed as expected (RED):", err.message);
  process.exit(1);
});
