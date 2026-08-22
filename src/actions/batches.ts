"use server";

import { prisma } from "@/lib/prisma";
import { Invariants } from "@/lib/invariants";
import { requireRole } from "@/lib/auth";
import { deleteFileFromStorage } from "@/lib/storage";
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
  const operator = await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
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
        if (operator.role !== "ADMIN") {
          throw new Error("仅超级管理员可执行特批放行");
        }
        await tx.specialApproval.create({
          data: {
            actionType: "OVER_QUOTA_INTAKE",
            farmerId: farmer.id,
            reason: data.specialReason,
            approvedById: data.createdById,
          },
        });
      } else {
        throw new Error(`超出年度额度: 当年已入池 ${cumulativeInPool} 只，本批 ${data.inPoolCount} 只，总额度 ${farmer.quota} 只（超 ${quotaCheck.excess} 只）`);
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
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const countToday = await tx.batch.count({
      where: { createdAt: { gte: todayStart } },
    });
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
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  const prevBatch = await prisma.batch.findUnique({
    where: { id: data.batchId },
    select: { reportUrl: true },
  });

  const batch = await prisma.batch.update({
    where: { id: data.batchId },
    data: {
      reportUrl: data.reportUrl,
      reportName: data.reportName,
      reportUploadedAt: new Date(),
    },
  });

  if (prevBatch?.reportUrl && prevBatch.reportUrl !== data.reportUrl) {
    await deleteFileFromStorage(prevBatch.reportUrl);
  }

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

export async function deleteBatchReportAction(data: {
  batchId: string;
  userId: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  const batch = await prisma.batch.findUniqueOrThrow({
    where: { id: data.batchId },
    select: { id: true, code: true, reportUrl: true, reportName: true },
  });

  if (batch.reportUrl) {
    await deleteFileFromStorage(batch.reportUrl);
  }

  const updated = await prisma.batch.update({
    where: { id: data.batchId },
    data: {
      reportUrl: null,
      reportName: null,
      reportUploadedAt: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "BATCH_REPORT_DELETE",
      entityType: "BATCH",
      entityId: batch.id,
      details: JSON.stringify({ batchCode: batch.code, prevReportName: batch.reportName }),
    },
  });

  try {
    revalidatePath("/batches");
    revalidatePath("/ledgers");
  } catch {}
  return updated;
}

export async function registerLossAction(data: {
  batchId: string;
  physicalCount: number;
  reason: string;
  inspectorId: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
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
      throw new Error("累计损耗率超 5%，请填写损耗原因");
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

    const remaining = batch.inPoolCount - batch.outPoolCount - lossResult.totalLoss;
    const newStatus = remaining === 0 ? "COMPLETED" : batch.status;

    const updatedBatch = await tx.batch.update({
      where: { id: batch.id },
      data: {
        lossCount: lossResult.totalLoss,
        status: newStatus,
        isException: lossResult.isException,
        exceptionReason: lossResult.isException ? data.reason : batch.exceptionReason,
      },
    });

    if (remaining === 0) {
      const activeInPool = await tx.batch.count({
        where: {
          poolId: batch.poolId,
          status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] },
        },
      });
      if (activeInPool === 0) {
        await tx.holdingPool.update({
          where: { id: batch.poolId },
          data: { currentGender: null, currentWeightTier: null },
        });
      }
    }

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
      revalidatePath("/pools");
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
  await requireRole(["QA_DIRECTOR", "ADMIN"]);
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

