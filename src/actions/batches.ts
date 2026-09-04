"use server";

import { prisma } from "@/lib/prisma";
import { Invariants } from "@/lib/invariants";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getBeijingDateStr } from "@/lib/utils";

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
      include: {
        batches: { where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
        batchItems: { where: { batch: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } } },
      },
    });

    const directLive = pool.batches.reduce((sum, b) => sum + (b.inPoolCount - b.outPoolCount - b.lossCount), 0);
    const itemLive = pool.batchItems.reduce((sum, bi) => sum + (bi.inPoolCount - bi.outPoolCount - bi.lossCount), 0);
    const activeInPool = pool.batchItems.length > 0 ? itemLive : directLive;
    const poolCheck = Invariants.checkPoolSpec(
      { currentGender: pool.currentGender, currentWeightTier: pool.currentWeightTier, activeCount: activeInPool },
      { gender: data.gender, weightTier: data.weightTier }
    );

    if (!poolCheck.valid) {
      throw new Error(`${pool.code} ${pool.name} ${poolCheck.reason}`);
    }

    if (poolCheck.requiresBinding) {
      await tx.holdingPool.update({
        where: { id: pool.id },
        data: { currentGender: data.gender, currentWeightTier: data.weightTier },
      });
    }

    const dateStr = getBeijingDateStr();
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
        quickCheck: data.reportUrl ? "QUALIFIED" : "PENDING",
        quickCheckUrl: data.reportUrl || null,
        quickCheckName: data.reportName || null,
        sampleCheck: "PENDING",
        items: {
          create: [
            {
              poolId: data.poolId,
              gender: data.gender,
              weightTier: data.weightTier,
              weight: Number((data.inPoolCount * 0.3).toFixed(1)),
              inPoolCount: data.inPoolCount,
            },
          ],
        },
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

export async function createMultiSpecBatchAction(data: {
  farmerId: string;
  enclosureId: string;
  formNo?: string;
  temp?: number;
  humidity?: number;
  escort?: string;
  slipUrl?: string;
  slipName?: string;
  quickCheck?: string;
  quickCheckUrl?: string;
  quickCheckName?: string;
  sampleCheck?: string;
  sampleCheckUrl?: string;
  sampleCheckName?: string;
  items: Array<{
    poolId: string;
    gender: string;
    weightTier: string;
    weight: number;
    inPoolCount: number;
  }>;
  createdById: string;
}) {
  try {
    await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);

    const batch = await prisma.$transaction(async (tx) => {
      const farmer = await tx.farmer.findUniqueOrThrow({
        where: { id: data.farmerId },
        include: { batches: true, enclosures: true },
      });

      if (farmer.status !== "ACTIVE") {
        throw new Error("该养殖户合作状态异常，禁止入池登记");
      }

      const totalBatchCount = data.items.reduce((sum, it) => sum + it.inPoolCount, 0);
      const cumulativeInPool = farmer.batches.reduce((sum, b) => sum + b.inPoolCount, 0);
      const quotaCheck = Invariants.checkQuota({
        annualQuota: farmer.quota,
        cumulativeInPool,
        newBatchCount: totalBatchCount,
      });

      if (!quotaCheck.valid) {
        throw new Error(`超出年度额度: 当年已入池 ${cumulativeInPool} 只，本批 ${totalBatchCount} 只，总额度 ${farmer.quota} 只（超 ${quotaCheck.excess} 只）`);
      }

      // 校验每个明细行入池规则：必须分配到空暂养池且同单不得重复分配同一池
      const usedPoolIds = new Set<string>();
      for (let i = 0; i < data.items.length; i++) {
        const it = data.items[i];
        if (usedPoolIds.has(it.poolId)) {
          throw new Error(`码单明细分配冲突：同一码单不同规格行必须分别存入不同的空暂养池，暂养池不可重复选择！`);
        }
        usedPoolIds.add(it.poolId);

        const pool = await tx.holdingPool.findUniqueOrThrow({
          where: { id: it.poolId },
          include: {
            batches: { where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
            batchItems: { where: { batch: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } } },
          },
        });
        const directLive = pool.batches.reduce((sum, b) => sum + (b.inPoolCount - b.outPoolCount - b.lossCount), 0);
        const itemLive = pool.batchItems.reduce((sum, bi) => sum + (bi.inPoolCount - bi.outPoolCount - bi.lossCount), 0);
        const activeInPool = pool.batchItems.length > 0 ? itemLive : directLive;
        const poolCheck = Invariants.checkPoolSpec(
          { currentGender: pool.currentGender, currentWeightTier: pool.currentWeightTier, activeCount: activeInPool },
          { gender: it.gender, weightTier: it.weightTier }
        );
        if (!poolCheck.valid) {
          throw new Error(`${pool.code} ${pool.name} ${poolCheck.reason}`);
        }

        await tx.holdingPool.update({
          where: { id: pool.id },
          data: { currentGender: it.gender, currentWeightTier: it.weightTier },
        });
      }

      const enclosureId = data.enclosureId || farmer.enclosures[0]?.id;
      if (!enclosureId) {
        throw new Error("该养殖户未关联有效围网，禁止入池");
      }

      const dateStr = getBeijingDateStr();
      const prefix = `YL${dateStr}`;
      const count = await tx.batch.count({ where: { code: { startsWith: prefix } } });
      const batchCode = `${prefix}${String(count + 1).padStart(2, "0")}`;

      const firstItem = data.items[0];

      const createdBatch = await tx.batch.create({
        data: {
          code: batchCode,
          farmerId: data.farmerId,
          enclosureId,
          poolId: firstItem?.poolId || "",
          gender: firstItem?.gender || "MALE",
          weightTier: firstItem?.weightTier || "4.0两",
          formNo: data.formNo || "YCGF-PZZX-202603",
          temp: data.temp || 18.5,
          humidity: data.humidity || 85.0,
          escort: data.escort || "跟车员",
          slipUrl: data.slipUrl || null,
          quickCheck: data.quickCheck || "PENDING",
          quickCheckUrl: data.quickCheckUrl || null,
          quickCheckName: data.quickCheckName || null,
          sampleCheck: data.sampleCheck || "PENDING",
          sampleCheckUrl: data.sampleCheckUrl || null,
          sampleCheckName: data.sampleCheckName || null,
          reportUrl: data.quickCheckUrl || data.sampleCheckUrl || null,
          reportName: data.quickCheckName || data.sampleCheckName || null,
          reportUploadedAt: (data.quickCheckUrl || data.sampleCheckUrl) ? new Date() : null,
          inPoolCount: totalBatchCount,
          createdById: data.createdById,
          items: {
            create: data.items.map((it) => ({
              poolId: it.poolId,
              gender: it.gender,
              weightTier: it.weightTier,
              weight: it.weight,
              inPoolCount: it.inPoolCount,
            })),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          operatorId: data.createdById,
          action: "MULTI_SPEC_BATCH_INTAKE",
          entityType: "BATCH",
          entityId: createdBatch.id,
          details: JSON.stringify({ batchCode, totalBatchCount, formNo: data.formNo, itemsCount: data.items.length }),
        },
      });

      return createdBatch;
    });

    try {
      revalidatePath("/batches");
      revalidatePath("/pools");
    } catch {}

    return { success: true, data: batch, code: batch.code };
  } catch (err: any) {
    return { success: false, error: err.message || "创建批次失败" };
  }
}

export async function updateBatchInspectionAction(data: {
  batchId: string;
  quickCheck: string;
  quickCheckUrl?: string | null;
  quickCheckName?: string | null;
  sampleCheck: string;
  sampleCheckUrl?: string | null;
  sampleCheckName?: string | null;
  inspectorId?: string;
}) {
  try {
    const operator = await requireRole(["QA_DIRECTOR", "ADMIN", "WAREHOUSE_ADMIN"]);

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.findUniqueOrThrow({
        where: { id: data.batchId },
      });

      const updated = await tx.batch.update({
        where: { id: data.batchId },
        data: {
          quickCheck: data.quickCheck,
          quickCheckUrl: data.quickCheckUrl ?? batch.quickCheckUrl,
          quickCheckName: data.quickCheckName ?? batch.quickCheckName,
          sampleCheck: data.sampleCheck,
          sampleCheckUrl: data.sampleCheckUrl ?? batch.sampleCheckUrl,
          sampleCheckName: data.sampleCheckName ?? batch.sampleCheckName,
          reportUrl: data.quickCheckUrl || data.sampleCheckUrl || batch.reportUrl,
          reportName: data.quickCheckName || data.sampleCheckName || batch.reportName,
          reportUploadedAt: (data.quickCheckUrl || data.sampleCheckUrl) ? new Date() : batch.reportUploadedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          operatorId: data.inspectorId || operator.id,
          action: "BATCH_INSPECTION_UPDATE",
          entityType: "BATCH",
          entityId: data.batchId,
          details: JSON.stringify({
            batchCode: batch.code,
            quickCheck: data.quickCheck,
            hasQuickCheckReport: !!(data.quickCheckUrl ?? batch.quickCheckUrl),
            sampleCheck: data.sampleCheck,
            hasSampleCheckReport: !!(data.sampleCheckUrl ?? batch.sampleCheckUrl),
          }),
        },
      });

      return updated;
    });

    try {
      revalidatePath("/batches");
      revalidatePath("/ledgers");
      revalidatePath("/pools");
    } catch {}

    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "更新品控检测报告失败" };
  }
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

    const items = await tx.batchItem.findMany({ where: { batchId: batch.id } });
    if (items.length > 0) {
      const activeItem = items.find((it) => it.inPoolCount - it.outPoolCount - it.lossCount > 0) || items[0];
      await tx.batchItem.update({
        where: { id: activeItem.id },
        data: {
          lossCount: activeItem.lossCount + lossResult.lossDelta,
        },
      });
    }

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

