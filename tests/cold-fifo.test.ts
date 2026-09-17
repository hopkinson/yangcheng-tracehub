import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { createColdIntakeAction, createBatchColdIntakeAction } from "../src/actions/production";

async function main() {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const admin = await prisma.user.create({
    data: {
      username: `cold_fifo_${suffix}`,
      phone: `134${String(Date.now()).slice(-8)}`,
      fullName: "预冷FIFO测试管理员",
      role: "ADMIN",
    },
  });
  const farmer = await prisma.farmer.create({
    data: {
      code: `JD-COLD-FIFO-${suffix}`,
      name: `预冷FIFO测试户-${suffix}`,
      phone: `133${String(Date.now()).slice(-8)}`,
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 10,
      quota: 6000,
    },
  });
  const enclosure = await prisma.enclosure.create({
    data: { code: `W-COLD-FIFO-${suffix}`, farmerId: farmer.id },
  });
  const pool = await prisma.holdingPool.create({
    data: { code: `ZY-COLD-FIFO-${suffix}`, name: `预冷FIFO测试池-${suffix}` },
  });
  const group = await prisma.bundleGroup.create({
    data: { code: `P-COLD-FIFO-${suffix}`, name: `预冷FIFO测试组-${suffix}` },
  });
  const claim = await prisma.tagClaim.create({
    data: {
      code: `XK-COLD-FIFO-${suffix}`,
      claimDate: new Date(),
      farmerId: farmer.id,
      claimCount: 100,
      status: "APPROVED",
      applicantId: admin.id,
    },
  });
  const machine = await prisma.sortMachine.create({
    data: { code: `FJ-COLD-FIFO-${suffix}`, name: `预冷FIFO测试机-${suffix}`, status: "ACTIVE" },
  });
  const store = await prisma.coldStore.create({
    data: { code: `BX-COLD-FIFO-${suffix}`, name: `预冷FIFO测试库-${suffix}` },
  });

  const earlyBatch = await prisma.batch.create({
    data: {
      code: `YL-COLD-FIFO-${suffix}-A`,
      farmerId: farmer.id,
      enclosureId: enclosure.id,
      poolId: pool.id,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolTime: new Date("1800-01-01T00:00:00.000Z"),
      inPoolCount: 10,
      outPoolCount: 10,
      status: "COMPLETED",
      createdById: admin.id,
    },
  });
  const laterBatch = await prisma.batch.create({
    data: {
      code: `YL-COLD-FIFO-${suffix}-B`,
      farmerId: farmer.id,
      enclosureId: enclosure.id,
      poolId: pool.id,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolTime: new Date("1800-01-02T00:00:00.000Z"),
      inPoolCount: 10,
      outPoolCount: 10,
      status: "COMPLETED",
      createdById: admin.id,
    },
  });
  const earlyBundle = await prisma.bundleBatch.create({
    data: {
      code: `KZD-COLD-FIFO-${suffix}-A`,
      groupId: group.id,
      sourceBatchId: earlyBatch.id,
      tagClaimId: claim.id,
      ropeBatch: `XS-${suffix}`,
      status: "COMPLETED",
      inputCount: 10,
      qualifiedCount: 10,
    },
  });
  const laterBundle = await prisma.bundleBatch.create({
    data: {
      code: `KZD-COLD-FIFO-${suffix}-B`,
      groupId: group.id,
      sourceBatchId: laterBatch.id,
      tagClaimId: claim.id,
      ropeBatch: `XS-${suffix}`,
      status: "COMPLETED",
      inputCount: 10,
      qualifiedCount: 10,
    },
  });
  const earlyTask = await prisma.sortTask.create({
    data: {
      code: `FJR-COLD-FIFO-${suffix}-A`,
      machineId: machine.id,
      bundleBatchId: earlyBundle.id,
      gender: "MALE",
      weightTier: "4.0两",
      inputCount: 10,
      qualifiedCount: 0,
      status: "PENDING",
    },
  });
  const laterTask = await prisma.sortTask.create({
    data: {
      code: `FJR-COLD-FIFO-${suffix}-B`,
      machineId: machine.id,
      bundleBatchId: laterBundle.id,
      gender: "MALE",
      weightTier: "4.0两",
      inputCount: 10,
      qualifiedCount: 10,
      status: "COMPLETED",
    },
  });

  let laterTask2: any = null;

  try {
    const blockedByPendingSort = await createColdIntakeAction({
      storeId: store.id,
      count: 10,
      sortTaskId: laterTask.id,
      operator: "FIFO测试仓管",
    });
    assert.equal(blockedByPendingSort.success, false, "前序原料仍待完成分拣时，后序原料不得抢先预冷");
    assert.match(blockedByPendingSort.message, new RegExp(earlyBatch.code));

    await prisma.sortTask.update({
      where: { id: earlyTask.id },
      data: { qualifiedCount: 10, status: "COMPLETED", doneAt: new Date() },
    });

    const blockedByPendingIntake = await createColdIntakeAction({
      storeId: store.id,
      count: 10,
      sortTaskId: laterTask.id,
      operator: "FIFO测试仓管",
    });
    assert.equal(blockedByPendingIntake.success, false, "前序原料仍未完成预冷入库时，后序原料不得抢先入库");
    assert.match(blockedByPendingIntake.message, new RegExp(earlyBatch.code));

    const earlyIntake = await createColdIntakeAction({
      storeId: store.id,
      count: 10,
      sortTaskId: earlyTask.id,
      operator: "FIFO测试仓管",
    });
    assert.equal(earlyIntake.success, true, earlyIntake.message);

    const [concurrentA, concurrentB] = await Promise.all([
      createColdIntakeAction({ storeId: store.id, count: 6, sortTaskId: laterTask.id, operator: "FIFO并发A" }),
      createColdIntakeAction({ storeId: store.id, count: 6, sortTaskId: laterTask.id, operator: "FIFO并发B" }),
    ]);
    assert.equal(
      Number(concurrentA.success) + Number(concurrentB.success),
      1,
      "两个并发入库请求最多只能有一个成功"
    );

    const laterIntake = await prisma.coldLog.aggregate({
      where: { type: "INTAKE", sortTaskId: laterTask.id },
      _sum: { count: true },
    });
    assert.equal(laterIntake._sum.count, 6, "并发入库后实际入库数不得超过分拣合格余量");

    // 测试批量多选入库与不拆分全额入库
    laterTask2 = await prisma.sortTask.create({
      data: {
        code: `FJR-COLD-FIFO-${suffix}-B2`,
        machineId: machine.id,
        bundleBatchId: laterBundle.id,
        gender: "FEMALE",
        weightTier: "3.0两",
        inputCount: 15,
        qualifiedCount: 15,
        status: "COMPLETED",
        doneAt: new Date(),
      },
    });

    // 1. 空选择拦截
    const emptyBatchRes = await createBatchColdIntakeAction({
      storeId: store.id,
      sortTaskIds: [],
      operator: "批量测试仓管",
    });
    assert.equal(emptyBatchRes.success, false, "空批次选择必须被拦截");

    // 2. 批量多选入库 (laterTask 剩余 4 只 + laterTask2 全额 15 只 = 19 只)
    const batchIntakeRes = await createBatchColdIntakeAction({
      storeId: store.id,
      sortTaskIds: [laterTask.id, laterTask2.id],
      operator: "批量测试仓管",
    });
    assert.equal(batchIntakeRes.success, true, batchIntakeRes.message);

    // 3. 再次尝试入库已入清批次必须被拦截
    const duplicateBatchRes = await createBatchColdIntakeAction({
      storeId: store.id,
      sortTaskIds: [laterTask2.id],
      operator: "批量测试仓管",
    });
    assert.equal(duplicateBatchRes.success, false, "已入清批次必须被拦截，不可重复入库");

    console.log("✓ 保鲜预冷原料批次 FIFO / 并发余量守恒 / 批量多选不拆分入库测试通过");
  } finally {
    await prisma.coldLog.deleteMany({
      where: { sortTaskId: { in: [earlyTask.id, laterTask.id, laterTask2.id] } },
    }).catch(() => {});
    await prisma.sortTask.deleteMany({ where: { id: { in: [earlyTask.id, laterTask.id, laterTask2.id] } } }).catch(() => {});
    await prisma.bundleBatch.deleteMany({ where: { id: { in: [earlyBundle.id, laterBundle.id] } } }).catch(() => {});
    await prisma.sortMachine.delete({ where: { id: machine.id } }).catch(() => {});
    await prisma.coldStore.delete({ where: { id: store.id } }).catch(() => {});
    await prisma.bundleGroup.delete({ where: { id: group.id } }).catch(() => {});
    await prisma.tagClaim.delete({ where: { id: claim.id } }).catch(() => {});
    await prisma.batch.deleteMany({ where: { id: { in: [earlyBatch.id, laterBatch.id] } } }).catch(() => {});
    await prisma.holdingPool.delete({ where: { id: pool.id } }).catch(() => {});
    await prisma.enclosure.delete({ where: { id: enclosure.id } }).catch(() => {});
    await prisma.farmer.delete({ where: { id: farmer.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: admin.id } }).catch(() => {});
  }
}

main()
  .catch((error) => {
    console.error("❌ 保鲜预冷 FIFO 测试失败:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
