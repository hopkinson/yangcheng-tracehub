import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { createBundleBatchAction, deleteBundleBatchAction } from "../src/actions/production";

async function main() {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const admin = await prisma.user.create({
    data: {
      username: `fifo_${suffix}`,
      phone: `137${String(Date.now()).slice(-8)}`,
      fullName: "FIFO测试管理员",
      role: "ADMIN",
    },
  });
  const firstCore = `FIFO${suffix}01`;
  const secondCore = `FIFO${suffix}02`;

  const farmer = await prisma.farmer.create({
    data: {
      code: `JD-FIFO-${suffix}`,
      name: `FIFO测试户-${suffix}`,
      phone: `139${String(Date.now()).slice(-8)}`,
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 10,
      quota: 6000,
    },
  });
  const enclosure = await prisma.enclosure.create({
    data: { code: `W-FIFO-${suffix}`, farmerId: farmer.id },
  });
  const firstPool = await prisma.holdingPool.create({
    data: {
      code: `ZY-FIFO-A-${suffix}`,
      name: `FIFO测试池A-${suffix}`,
      currentGender: "MALE",
      currentWeightTier: "4.0两",
    },
  });
  const secondPool = await prisma.holdingPool.create({
    data: {
      code: `ZY-FIFO-B-${suffix}`,
      name: `FIFO测试池B-${suffix}`,
      currentGender: "MALE",
      currentWeightTier: "4.0两",
    },
  });

  const firstBatch = await prisma.batch.create({
    data: {
      code: `YL${firstCore}`,
      farmerId: farmer.id,
      enclosureId: enclosure.id,
      poolId: firstPool.id,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolTime: new Date("1900-01-01T00:00:00.000Z"),
      inPoolCount: 300,
      createdById: admin.id,
      items: {
        create: [{ poolId: firstPool.id, gender: "MALE", weightTier: "4.0两", inPoolCount: 300 }],
      },
    },
    include: { items: true },
  });
  const secondBatch = await prisma.batch.create({
    data: {
      code: `YL${secondCore}`,
      farmerId: farmer.id,
      enclosureId: enclosure.id,
      poolId: secondPool.id,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolTime: new Date("1900-01-02T00:00:00.000Z"),
      inPoolCount: 300,
      createdById: admin.id,
      items: {
        create: [{ poolId: secondPool.id, gender: "MALE", weightTier: "4.0两", inPoolCount: 300 }],
      },
    },
  });
  const tagClaim = await prisma.tagClaim.create({
    data: {
      code: `XK-FIFO-${suffix}`,
      claimDate: new Date(),
      farmerId: farmer.id,
      claimCount: 1000,
      status: "APPROVED",
      applicantId: admin.id,
    },
  });
  const group = await prisma.bundleGroup.create({
    data: { code: `P-FIFO-${suffix}`, name: `FIFO测试组-${suffix}` },
  });

  try {
    const blocked = await createBundleBatchAction({
      batchId: secondBatch.id,
      groupId: group.id,
      tagClaimId: tagClaim.id,
      ropeBatch: `XS-FIFO-${suffix}`,
      lines: [{ poolId: secondPool.id, gender: "MALE", weightTier: "4.0两", count: 50 }],
    });
    assert.equal(blocked.success, false, "后入池批次必须被 FIFO 拦截");
    assert.ok(blocked.message.includes(firstBatch.code), "FIFO 拦截提示应指向最早原料批次");

    const first = await createBundleBatchAction({
      batchId: firstBatch.id,
      groupId: group.id,
      tagClaimId: tagClaim.id,
      ropeBatch: `XS-FIFO-${suffix}`,
      lines: [{ poolId: firstPool.id, gender: "MALE", weightTier: "4.0两", count: 100 }],
    });
    assert.equal(first.success, true, first.message);
    assert.equal(first.code, `KZD${firstCore}`, "首个捆扎批次应直接继承原料核心编码");

    const second = await createBundleBatchAction({
      batchId: firstBatch.id,
      groupId: group.id,
      tagClaimId: tagClaim.id,
      ropeBatch: `XS-FIFO-${suffix}`,
      lines: [{ poolId: firstPool.id, gender: "MALE", weightTier: "4.0两", count: 100 }],
    });
    assert.equal(second.success, true, second.message);
    assert.equal(second.code, `KZD${firstCore}-2`, "一对多时第二个捆扎批次应追加 -2");

    const bundles = await prisma.bundleBatch.findMany({
      where: { sourceBatchId: firstBatch.id },
      orderBy: { createdAt: "asc" },
    });
    assert.deepEqual(
      bundles.map((bundle) => bundle.code),
      [`KZD${firstCore}-1`, `KZD${firstCore}-2`],
      "一对多后应统一为 -1/-2 编码"
    );

    const afterBundling = await prisma.batch.findUniqueOrThrow({
      where: { id: firstBatch.id },
      include: { items: true },
    });
    assert.equal(afterBundling.outPoolCount, 200, "只应扣减所选原料批次库存");
    assert.equal(afterBundling.items[0].outPoolCount, 200, "BatchItem 应同步扣减 200 只");

    const untouchedLater = await prisma.batch.findUniqueOrThrow({ where: { id: secondBatch.id } });
    assert.equal(untouchedLater.outPoolCount, 0, "后续原料批次库存不能被提前扣减");

    const deleteRes = await deleteBundleBatchAction(bundles[1].id);
    assert.equal(deleteRes.success, true, deleteRes.message);

    const afterDelete = await prisma.batch.findUniqueOrThrow({
      where: { id: firstBatch.id },
      include: { items: true },
    });
    assert.equal(afterDelete.outPoolCount, 100, "撤销必须准确还回原始原料批次");
    assert.equal(afterDelete.items[0].outPoolCount, 100, "撤销必须准确还回原始 BatchItem");
  } finally {
    await prisma.bundleLine.deleteMany({ where: { bundleBatch: { sourceBatchId: { in: [firstBatch.id, secondBatch.id] } } } }).catch(() => {});
    await prisma.bundleBatch.deleteMany({ where: { sourceBatchId: { in: [firstBatch.id, secondBatch.id] } } }).catch(() => {});
    await prisma.tagClaim.delete({ where: { id: tagClaim.id } }).catch(() => {});
    await prisma.bundleGroup.delete({ where: { id: group.id } }).catch(() => {});
    await prisma.batchItem.deleteMany({ where: { batchId: { in: [firstBatch.id, secondBatch.id] } } }).catch(() => {});
    await prisma.batch.deleteMany({ where: { id: { in: [firstBatch.id, secondBatch.id] } } }).catch(() => {});
    await prisma.holdingPool.deleteMany({ where: { id: { in: [firstPool.id, secondPool.id] } } }).catch(() => {});
    await prisma.enclosure.delete({ where: { id: enclosure.id } }).catch(() => {});
    await prisma.farmer.delete({ where: { id: farmer.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: admin.id } }).catch(() => {});
  }
}

main().then(() => {
  console.log("✔ 捆扎原料批次 FIFO / 编码 / 精准还库测试通过");
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
