import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { createStoreOutboundAction, registerOutboundLossAction, resubmitOutboundOrderAction } from "../src/actions/outbound";
import { resolveTraceQuery } from "../src/lib/trace-service";
import { aggregateTraceableColdStocks } from "../src/lib/cold-stock";

async function main() {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const admin = await prisma.user.create({
    data: {
      username: `out_fifo_${suffix}`,
      phone: `136${String(Date.now()).slice(-8)}`,
      fullName: "出库FIFO测试管理员",
      role: "ADMIN",
    },
  });
  const channel = await prisma.channel.create({
    data: { name: `FIFO测试渠道-${suffix}` },
  });
  const store = await prisma.store.create({
    data: { code: `ST-FIFO-${suffix}`, name: `FIFO测试门店-${suffix}`, channelId: channel.id },
  });
  const farmer = await prisma.farmer.create({
    data: {
      code: `JD-OUT-FIFO-${suffix}`,
      name: `FIFO测试养殖户-${suffix}`,
      phone: `135${String(Date.now()).slice(-8)}`,
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 10,
      quota: 6000,
    },
  });
  const enclosure = await prisma.enclosure.create({
    data: { code: `W-OUT-FIFO-${suffix}`, farmerId: farmer.id },
  });
  const pool = await prisma.holdingPool.create({
    data: { code: `ZY-OUT-FIFO-${suffix}`, name: `FIFO测试池-${suffix}`, currentGender: "MALE", currentWeightTier: "6两" },
  });
  const earlyBatch = await prisma.batch.create({
    data: {
      code: `YL-OUT-FIFO-${suffix}-A`,
      farmerId: farmer.id,
      enclosureId: enclosure.id,
      poolId: pool.id,
      gender: "MALE",
      weightTier: "6两",
      inPoolTime: new Date("1990-01-01T00:00:00.000Z"),
      inPoolCount: 60,
      outPoolCount: 60,
      status: "COMPLETED",
      createdById: admin.id,
    },
  });
  const laterBatch = await prisma.batch.create({
    data: {
      code: `YL-OUT-FIFO-${suffix}-B`,
      farmerId: farmer.id,
      enclosureId: enclosure.id,
      poolId: pool.id,
      gender: "MALE",
      weightTier: "6两",
      inPoolTime: new Date("1990-01-02T00:00:00.000Z"),
      inPoolCount: 100,
      outPoolCount: 100,
      status: "COMPLETED",
      createdById: admin.id,
    },
  });
  const claim = await prisma.tagClaim.create({
    data: {
      code: `XK-OUT-FIFO-${suffix}`,
      claimDate: new Date(),
      farmerId: farmer.id,
      claimCount: 200,
      status: "APPROVED",
      applicantId: admin.id,
    },
  });
  const group = await prisma.bundleGroup.create({
    data: { code: `P-OUT-FIFO-${suffix}`, name: `FIFO测试捆扎组-${suffix}` },
  });
  const earlyBundle = await prisma.bundleBatch.create({
    data: {
      code: `KZD-OUT-FIFO-${suffix}-A`,
      groupId: group.id,
      sourceBatchId: earlyBatch.id,
      tagClaimId: claim.id,
      ropeBatch: `XS-${suffix}`,
      status: "COMPLETED",
    },
  });
  const laterBundle = await prisma.bundleBatch.create({
    data: {
      code: `KZD-OUT-FIFO-${suffix}-B`,
      groupId: group.id,
      sourceBatchId: laterBatch.id,
      tagClaimId: claim.id,
      ropeBatch: `XS-${suffix}`,
      status: "COMPLETED",
    },
  });
  const machine = await prisma.sortMachine.create({
    data: { code: `FJ-OUT-FIFO-${suffix}`, name: `FIFO测试分拣机-${suffix}`, status: "ACTIVE" },
  });
  const earlyTask = await prisma.sortTask.create({
    data: {
      code: `FJR-OUT-FIFO-${suffix}-A`,
      machineId: machine.id,
      bundleBatchId: earlyBundle.id,
      gender: "MALE",
      weightTier: "6两",
      inputCount: 60,
      qualifiedCount: 60,
      status: "COMPLETED",
    },
  });
  const laterTask = await prisma.sortTask.create({
    data: {
      code: `FJR-OUT-FIFO-${suffix}-B`,
      machineId: machine.id,
      bundleBatchId: laterBundle.id,
      gender: "MALE",
      weightTier: "6两",
      inputCount: 100,
      qualifiedCount: 100,
      status: "COMPLETED",
    },
  });
  const coldStore = await prisma.coldStore.create({
    data: { code: `BX-OUT-FIFO-${suffix}`, name: `FIFO测试保鲜库-${suffix}` },
  });
  const earlyColdLog = await prisma.coldLog.create({
    data: {
      code: `CR-OUT-FIFO-${suffix}-A`,
      storeId: coldStore.id,
      type: "INTAKE",
      count: 60,
      sortTaskId: earlyTask.id,
      operator: "FIFO测试仓管",
    },
  });
  const laterColdLog = await prisma.coldLog.create({
    data: {
      code: `CR-OUT-FIFO-${suffix}-B`,
      storeId: coldStore.id,
      type: "INTAKE",
      count: 100,
      sortTaskId: laterTask.id,
      operator: "FIFO测试仓管",
    },
  });
  const order = await prisma.order.create({
    data: {
      code: `SO-OUT-FIFO-${suffix}`,
      importId: `IM-OUT-FIFO-${suffix}`,
      orderNo: `SM-OUT-FIFO-${suffix}`,
      type: "STORE_ORDER",
      storeId: store.id,
      storeName: store.name,
      gender: "MALE",
      weightTier: "6两",
      count: 100,
      deliveryDate: new Date(),
      status: "PENDING",
    },
  });

  let outboundId: string | null = null;
  let lossAuditId: string | null = null;

  try {
    await assert.rejects(
      () => registerOutboundLossAction({ gender: "MALE", weightTier: "6两", lossCount: 9 }),
      /累计出库损耗率超 5%/,
      "累计出库损耗率超过 5% 时必须填写原因"
    );

    const lossResult = await registerOutboundLossAction({
      gender: "MALE",
      weightTier: "6两",
      lossCount: 9,
      reason: "FIFO损耗回归测试",
    });
    assert.equal(lossResult.availableAfter, 151, "独立规格库存损耗后应正确扣减 9 只");

    const lossRecords = await prisma.outboundLossRecord.findMany({
      where: { coldLogId: { in: [earlyColdLog.id, laterColdLog.id] } },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(lossRecords.length, 1, "本次损耗应只占用最早 FIFO 冷库批次");
    assert.equal(lossRecords[0].coldLogId, earlyColdLog.id, "出库损耗必须先扣最早入池原料对应的 ColdLog");
    assert.equal(lossRecords[0].count, 9, "最早 ColdLog 应核减 9 只损耗");

    const lossAudit = await prisma.auditLog.findFirst({
      where: { action: "OUTBOUND_LOSS_REGISTER", details: { contains: suffix } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    lossAuditId = lossAudit?.id || null;

    const outbound = await createStoreOutboundAction({
      storeId: store.id,
      orderIds: [order.id],
      contactName: "FIFO测试联系人",
      contactPhone: "13800000000",
      applicantId: admin.id,
    });
    outboundId = outbound.id;

    const lines = await prisma.outboundLine.findMany({
      where: { outboundOrderId: outbound.id },
      orderBy: { createdAt: "asc" },
      include: {
        coldLog: {
          include: {
            sortTask: { include: { bundleBatch: { include: { sourceBatch: true } } } },
          },
        },
      },
    });

    assert.equal(lines.length, 2, "跨原料批次出库必须自动拆成两条绑定明细");
    assert.equal(lines[0].coldLogId, earlyColdLog.id, "必须先消耗最早入池原料对应的冷库批次");
    assert.equal(lines[0].count, 51, "最早批次扣除 9 只损耗后，应先出库剩余 51 只");
    assert.equal(lines[0].coldLog?.sortTask?.bundleBatch.sourceBatch?.id, earlyBatch.id, "首条明细必须追溯到最早原料批次");
    assert.equal(lines[1].coldLogId, laterColdLog.id, "前序批次耗尽后才允许使用后续批次");
    assert.equal(lines[1].count, 49, "后续批次只补足剩余 49 只");
    assert.equal(lines[1].coldLog?.sortTask?.bundleBatch.sourceBatch?.id, laterBatch.id, "第二条明细必须追溯到后续原料批次");
    assert.equal(outbound.batchId, earlyBatch.id, "兼容单头 batchId 只能取本次 FIFO 的首个原料批次");

    const uiStock = aggregateTraceableColdStocks({
      sortTasks: [
        { id: earlyTask.id, code: earlyTask.code, gender: "MALE", weightTier: "6两", bundleBatch: { sourceBatchId: earlyBatch.id } },
        { id: laterTask.id, code: laterTask.code, gender: "MALE", weightTier: "6两", bundleBatch: { sourceBatchId: laterBatch.id } },
      ],
      coldLogs: [
        { id: earlyColdLog.id, count: earlyColdLog.count, type: earlyColdLog.type, sortTaskId: earlyTask.id },
        { id: laterColdLog.id, count: laterColdLog.count, type: laterColdLog.type, sortTaskId: laterTask.id },
      ],
      outboundLines: lines.map((line) => ({ count: line.count, coldLogId: line.coldLogId })),
      outboundLosses: lossRecords.map((record) => ({ count: record.count, coldLogId: record.coldLogId })),
      defaultSpecs: [],
    });
    assert.equal(uiStock[0]?.available, 51, "页面库存聚合必须只按真实 coldLogId 链路扣减库存");

    const trace = await resolveTraceQuery(order.orderNo);
    assert.equal(trace?.lines?.length, 2, "溯源必须按拆分后的真实出库明细展示两条链路");
    assert.ok(trace?.lines?.[0]?.chain?.[0]?.title.includes(earlyBatch.code), "首条溯源必须直接指向最早原料批次");
    assert.ok(trace?.lines?.[1]?.chain?.[0]?.title.includes(laterBatch.code), "第二条溯源必须直接指向后续原料批次");

    await prisma.outboundOrder.update({ where: { id: outbound.id }, data: { status: "REJECTED" } });
    await assert.rejects(
      () => resubmitOutboundOrderAction({ orderId: outbound.id, storeId: store.id, outboundCount: 99, applicantId: admin.id }),
      /不可修改门店或数量/,
      "已绑定 FIFO 明细的驳回单不得单独修改出库数量"
    );
    const resubmitted = await resubmitOutboundOrderAction({
      orderId: outbound.id,
      storeId: store.id,
      outboundCount: 100,
      applicantId: admin.id,
    });
    assert.equal(resubmitted.status, "PENDING", "保持原门店和原数量时应允许重新提报");

    console.log("✓ 出库按原料入池时间 FIFO 自动拆行并保持全链路绑定");
  } finally {
    await prisma.$transaction(async (tx) => {
      if (outboundId) {
        await tx.auditLog.deleteMany({ where: { entityId: outboundId } });
        await tx.outboundLine.deleteMany({ where: { outboundOrderId: outboundId } });
        await tx.outboundOrder.delete({ where: { id: outboundId } });
      }
      await tx.order.delete({ where: { id: order.id } });
      if (lossAuditId) await tx.auditLog.delete({ where: { id: lossAuditId } });
      await tx.outboundLossRecord.deleteMany({ where: { coldLogId: { in: [earlyColdLog.id, laterColdLog.id] } } });
      await tx.coldLog.deleteMany({ where: { id: { in: [earlyColdLog.id, laterColdLog.id] } } });
      await tx.sortTask.deleteMany({ where: { id: { in: [earlyTask.id, laterTask.id] } } });
      await tx.sortMachine.delete({ where: { id: machine.id } });
      await tx.bundleBatch.deleteMany({ where: { id: { in: [earlyBundle.id, laterBundle.id] } } });
      await tx.bundleGroup.delete({ where: { id: group.id } });
      await tx.tagClaim.delete({ where: { id: claim.id } });
      await tx.batch.deleteMany({ where: { id: { in: [earlyBatch.id, laterBatch.id] } } });
      await tx.holdingPool.delete({ where: { id: pool.id } });
      await tx.enclosure.delete({ where: { id: enclosure.id } });
      await tx.farmer.delete({ where: { id: farmer.id } });
      await tx.store.delete({ where: { id: store.id } });
      await tx.channel.delete({ where: { id: channel.id } });
      await tx.user.delete({ where: { id: admin.id } });
    });
  }
}

main()
  .catch((error) => {
    console.error("❌ 出库 FIFO 测试失败:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
