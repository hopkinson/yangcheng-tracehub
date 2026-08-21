"use server";

import { prisma } from "@/lib/prisma";
import { Invariants } from "@/lib/invariants";
import { revalidatePath } from "next/cache";

export async function createBatchAction(data: {
  farmerId: string;
  enclosureId: string;
  poolId: string;
  gender: string;
  weightTier: string;
  inPoolCount: number;
  createdById: string;
  allowSpecialApproval?: boolean;
  specialReason?: string;
  reportUrl?: string;
  reportName?: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const farmer = await tx.farmer.findUniqueOrThrow({
      where: { id: data.farmerId },
      include: { batches: true },
    });

    if (farmer.status !== "ACTIVE") {
      throw new Error("该养殖户合作状态异常，禁止入池登记");
    }

    const cumulativeInPool = farmer.batches.reduce((sum, b) => sum + b.inPoolCount, 0);
    const quotaCheck = Invariants.checkQuota({
      annualQuota: farmer.quota,
      cumulativeInPool,
      newBatchCount: data.inPoolCount,
    });

    if (!quotaCheck.valid) {
      if (data.allowSpecialApproval && data.specialReason) {
        await tx.specialApproval.create({
          data: {
            actionType: "OVER_QUOTA_INTAKE",
            farmerId: farmer.id,
            reason: data.specialReason,
            approvedById: data.createdById,
          },
        });
      } else {
        throw new Error(`入池超额拦截: 当年累计入池 ${cumulativeInPool} 只，本批 ${data.inPoolCount} 只，超出年度总额度 ${farmer.quota} 只（超出 ${quotaCheck.excess} 只）`);
      }
    }

    const pool = await tx.holdingPool.findUniqueOrThrow({
      where: { id: data.poolId },
      include: { batches: { where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } } },
    });

    const activeInPool = pool.batches.reduce((sum, b) => sum + (b.inPoolCount - b.outPoolCount - b.lossCount), 0);
    const poolCheck = Invariants.checkPoolSpec(
      { currentGender: pool.currentGender, currentWeightTier: pool.currentWeightTier, activeCount: activeInPool },
      { gender: data.gender, weightTier: data.weightTier }
    );

    if (!poolCheck.valid) {
      throw new Error(poolCheck.reason);
    }

    if (poolCheck.requiresBinding) {
      await tx.holdingPool.update({
        where: { id: pool.id },
        data: { currentGender: data.gender, currentWeightTier: data.weightTier },
      });
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const countToday = await tx.batch.count();
    const batchCode = `PC-${dateStr}-${String(countToday + 1).padStart(3, "0")}`;

    const batch = await tx.batch.create({
      data: {
        code: batchCode,
        farmerId: data.farmerId,
        enclosureId: data.enclosureId,
        poolId: data.poolId,
        gender: data.gender,
        weightTier: data.weightTier,
        inPoolCount: data.inPoolCount,
        createdById: data.createdById,
        reportUrl: data.reportUrl || null,
        reportName: data.reportName || null,
        reportUploadedAt: data.reportUrl ? new Date() : null,
      },
    });

    await tx.auditLog.create({
      data: {
        operatorId: data.createdById,
        action: "BATCH_INTAKE",
        entityType: "BATCH",
        entityId: batch.id,
        details: JSON.stringify({ batchCode, inPoolCount: data.inPoolCount, poolCode: pool.code, hasReport: !!data.reportUrl }),
      },
    });

    try {
      revalidatePath("/batches");
      revalidatePath("/pools");
      revalidatePath("/ledgers");
    } catch {}
    return batch;
  });
}

export async function uploadBatchReportAction(data: {
  batchId: string;
  reportUrl: string;
  reportName: string;
  userId: string;
}) {
  const batch = await prisma.batch.update({
    where: { id: data.batchId },
    data: {
      reportUrl: data.reportUrl,
      reportName: data.reportName,
      reportUploadedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "BATCH_REPORT_UPLOAD",
      entityType: "BATCH",
      entityId: batch.id,
      details: JSON.stringify({ batchCode: batch.code, reportName: data.reportName }),
    },
  });

  try {
    revalidatePath("/batches");
    revalidatePath("/ledgers");
  } catch {}
  return batch;
}

export async function registerLossAction(data: {
  batchId: string;
  physicalCount: number;
  reason: string;
  inspectorId: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const batch = await tx.batch.findUniqueOrThrow({
      where: { id: data.batchId },
    });

    const bookInPool = batch.inPoolCount - batch.outPoolCount - batch.lossCount;
    const lossResult = Invariants.calculateLoss({
      bookInPool,
      physicalCount: data.physicalCount,
      inPoolCount: batch.inPoolCount,
      historicalLoss: batch.lossCount,
    });

    if (!lossResult.valid) {
      throw new Error(lossResult.reason);
    }

    if (lossResult.isException && (!data.reason || data.reason.trim() === "")) {
      throw new Error("损耗率超过 5% 告警红线，损耗原因必须详细填写并上报品控！");
    }

    const record = await tx.lossRecord.create({
      data: {
        batchId: batch.id,
        bookInPool,
        physicalCount: data.physicalCount,
        lossCount: lossResult.lossDelta,
        cumulativeLoss: lossResult.totalLoss,
        lossRate: lossResult.lossRate,
        reason: data.reason || "常规盘点损耗",
        inspectorId: data.inspectorId,
      },
    });

    const updatedBatch = await tx.batch.update({
      where: { id: batch.id },
      data: {
        lossCount: lossResult.totalLoss,
        isException: lossResult.isException,
        exceptionReason: lossResult.isException ? data.reason : batch.exceptionReason,
      },
    });

    await tx.auditLog.create({
      data: {
        operatorId: data.inspectorId,
        action: "LOSS_REGISTER",
        entityType: "LOSS_RECORD",
        entityId: record.id,
        details: JSON.stringify({ batchCode: batch.code, lossDelta: lossResult.lossDelta, lossRate: lossResult.lossRate }),
      },
    });

    try {
      revalidatePath("/batches");
    } catch {}
    return { record, updatedBatch };
  });
}

export async function toggleBatchFreezeAction(data: {
  batchId: string;
  freeze: boolean;
  reason?: string;
  userId: string;
}) {
  const batch = await prisma.batch.findUniqueOrThrow({
    where: { id: data.batchId },
  });

  const newStatus = data.freeze ? "FROZEN" : (batch.outPoolCount > 0 ? "PARTIALLY_OUTBOUND" : "TEMPORARY_HOLDING");

  const updated = await prisma.batch.update({
    where: { id: data.batchId },
    data: {
      status: newStatus,
      isException: data.freeze,
      exceptionReason: data.freeze ? data.reason || "品控争议冻结" : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: data.freeze ? "FREEZE_BATCH" : "UNFREEZE_BATCH",
      entityType: "BATCH",
      entityId: batch.id,
      details: JSON.stringify({ batchCode: batch.code, status: newStatus, reason: data.reason }),
    },
  });

  try {
    revalidatePath("/batches");
    revalidatePath("/outbound");
    revalidatePath("/pools");
  } catch {}
  return updated;
}

