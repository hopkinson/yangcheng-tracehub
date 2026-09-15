"use server";

import { prisma } from "@/lib/prisma";
import { Invariants } from "@/lib/invariants";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getBeijingDateStr } from "@/lib/utils";

type FifoColdLot = {
  coldLogId: string;
  sourceBatchId: string;
  sourceBatchCode: string;
  intakeCount: number;
  availableCount: number;
  inPoolTime: Date;
  createdAt: Date;
};

function tierVariants(rawWeightTier: string) {
  const normalizedTier = Invariants.normalizeWeightTier(rawWeightTier);
  const legacyTier = normalizedTier.endsWith(".0两") ? normalizedTier.replace(".0两", "两") : normalizedTier;
  return Array.from(new Set([rawWeightTier, normalizedTier, legacyTier]));
}

// 唯一库存来源：ColdLog -> SortTask -> BundleBatch -> Batch。
// 历史 ColdLog 允许仅通过 refId 关联分拣任务；新记录始终写 sortTaskId。
async function getFifoColdLots(gender: string, rawWeightTier: string, db: any = prisma): Promise<FifoColdLot[]> {
  const tiers = tierVariants(rawWeightTier);
  const tasks = await db.sortTask.findMany({
    where: {
      status: "COMPLETED",
      gender,
      weightTier: { in: tiers },
      bundleBatch: { sourceBatchId: { not: null } },
    },
    include: {
      bundleBatch: {
        include: {
          sourceBatch: { select: { id: true, code: true, inPoolTime: true } },
        },
      },
    },
  });
  if (tasks.length === 0) return [];

  const taskIds = tasks.map((task: any) => task.id);
  const taskRefs = tasks.flatMap((task: any) => [task.id, task.code]);
  const taskByRef = new Map<string, any>();
  for (const task of tasks) {
    taskByRef.set(task.id, task);
    taskByRef.set(task.code, task);
  }

  const logs = await db.coldLog.findMany({
    where: {
      type: "INTAKE",
      OR: [
        { sortTaskId: { in: taskIds } },
        { sortTaskId: null, refId: { in: taskRefs } },
      ],
    },
    select: { id: true, sortTaskId: true, refId: true, count: true, createdAt: true },
  });

  const traceableLogs = logs.flatMap((log: any) => {
    const task = log.sortTaskId
      ? taskByRef.get(log.sortTaskId)
      : log.refId
        ? taskByRef.get(log.refId)
        : null;
    const sourceBatch = task?.bundleBatch?.sourceBatch;
    return sourceBatch ? [{ log, sourceBatch }] : [];
  });
  if (traceableLogs.length === 0) return [];

  const logIds = traceableLogs.map(({ log }: any) => log.id);
  const [boundOutbound, legacyOutbound, boundLoss] = await Promise.all([
    db.outboundLine.findMany({
      where: { coldLogId: { in: logIds }, outboundOrder: { status: { not: "REJECTED" } } },
      select: { coldLogId: true, count: true },
    }),
    db.outboundLine.findMany({
      where: {
        coldLogId: null,
        gender,
        weightTier: { in: tiers },
        outboundOrder: { status: { not: "REJECTED" } },
      },
      select: { count: true },
    }),
    db.outboundLossRecord.findMany({
      where: { coldLogId: { in: logIds } },
      select: { coldLogId: true, count: true },
    }),
  ]);

  const usedByLog = new Map<string, number>();
  for (const row of boundOutbound) {
    if (!row.coldLogId) continue;
    usedByLog.set(row.coldLogId, (usedByLog.get(row.coldLogId) || 0) + row.count);
  }
  const lossByLog = new Map<string, number>();
  for (const row of boundLoss) lossByLog.set(row.coldLogId, (lossByLog.get(row.coldLogId) || 0) + row.count);

  const lots = traceableLogs
    .map(({ log, sourceBatch }: any) => ({
      coldLogId: log.id,
      sourceBatchId: sourceBatch.id,
      sourceBatchCode: sourceBatch.code,
      intakeCount: log.count,
      availableCount: Math.max(0, log.count - (usedByLog.get(log.id) || 0) - (lossByLog.get(log.id) || 0)),
      inPoolTime: sourceBatch.inPoolTime,
      createdAt: log.createdAt,
    } satisfies FifoColdLot))
    .sort((a: FifoColdLot, b: FifoColdLot) =>
      a.inPoolTime.getTime() - b.inPoolTime.getTime() || a.createdAt.getTime() - b.createdAt.getTime()
    );

  // 旧出库明细没有 coldLogId，只能确定规格。按同一 FIFO 顺序消耗历史库存，
  // 避免旧发货量在升级后重新变成“可发库存”。
  let legacyUsed = legacyOutbound.reduce((sum: number, row: any) => sum + row.count, 0);
  for (const lot of lots) {
    if (legacyUsed <= 0) break;
    const used = Math.min(lot.availableCount, legacyUsed);
    lot.availableCount -= used;
    legacyUsed -= used;
  }

  return lots;
}

async function getColdStorageStock(gender: string, rawWeightTier: string, db: any = prisma) {
  const tiers = tierVariants(rawWeightTier);
  const lots = await getFifoColdLots(gender, rawWeightTier, db);
  const lossAgg = await db.outboundLossRecord.aggregate({
    where: { gender, weightTier: { in: tiers } },
    _sum: { count: true },
  });
  return {
    totalQualified: lots.reduce((sum, lot) => sum + lot.intakeCount, 0),
    totalLoss: lossAgg._sum.count || 0,
    availableCount: lots.reduce((sum, lot) => sum + lot.availableCount, 0),
  };
}

async function allocateColdStockFIFO(gender: string, weightTier: string, count: number, db: any) {
  const lots = await getFifoColdLots(gender, weightTier, db);
  const available = lots.reduce((sum, lot) => sum + lot.availableCount, 0);
  if (available < count) {
    const label = `${gender === "FEMALE" ? "母蟹" : "公蟹"} ${Invariants.normalizeWeightTier(weightTier)}`;
    throw new Error(`冷库库存不足：${label} 仅剩可用 ${available} 只，本次需要 ${count} 只`);
  }

  let remaining = count;
  const allocations: Array<{ coldLogId: string; sourceBatchId: string; sourceBatchCode: string; count: number }> = [];
  for (const lot of lots) {
    if (remaining <= 0) break;
    if (lot.availableCount <= 0) continue;
    const allocated = Math.min(remaining, lot.availableCount);
    allocations.push({
      coldLogId: lot.coldLogId,
      sourceBatchId: lot.sourceBatchId,
      sourceBatchCode: lot.sourceBatchCode,
      count: allocated,
    });
    remaining -= allocated;
  }
  return allocations;
}

async function buildFifoOutboundLines(orders: any[], db: any, lineExtra?: (order: any) => Record<string, unknown>) {
  const demands = new Map<string, { gender: string; weightTier: string; count: number }>();
  for (const order of orders) {
    const weightTier = Invariants.normalizeWeightTier(order.weightTier);
    const key = `${order.gender}_${weightTier}`;
    const current = demands.get(key) || { gender: order.gender, weightTier, count: 0 };
    current.count += order.count;
    demands.set(key, current);
  }

  const allocationQueues = new Map<string, Array<{ coldLogId: string; sourceBatchId: string; sourceBatchCode: string; remaining: number }>>();
  for (const [key, demand] of demands) {
    const allocations = await allocateColdStockFIFO(demand.gender, demand.weightTier, demand.count, db);
    allocationQueues.set(key, allocations.map((item) => ({ ...item, remaining: item.count })));
  }

  const lines: any[] = [];
  for (const order of orders) {
    const weightTier = Invariants.normalizeWeightTier(order.weightTier);
    const key = `${order.gender}_${weightTier}`;
    const queue = allocationQueues.get(key) || [];
    let remaining = order.count;
    for (const allocation of queue) {
      if (remaining <= 0) break;
      if (allocation.remaining <= 0) continue;
      const count = Math.min(remaining, allocation.remaining);
      lines.push({
        orderId: order.id,
        orderNo: order.orderNo,
        gender: order.gender,
        weightTier,
        count,
        coldLogId: allocation.coldLogId,
        ...(lineExtra?.(order) || {}),
      });
      allocation.remaining -= count;
      remaining -= count;
    }
    if (remaining > 0) throw new Error(`FIFO 分配失败：订单 ${order.orderNo} 尚有 ${remaining} 只未分配`);
  }

  const firstLine = lines[0];
  const firstAllocation = firstLine
    ? Array.from(allocationQueues.values()).flat().find((item) => item.coldLogId === firstLine.coldLogId)
    : null;
  if (!firstLine || !firstAllocation) throw new Error("没有可用于出库的已绑定冷库批次");
  return { lines, firstAllocation };
}

export async function registerOutboundLossAction(data: {
  gender: string;
  weightTier: string;
  lossCount: number;
  reason?: string;
}) {
  const user = await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  const gender = data.gender === "FEMALE" ? "FEMALE" : data.gender === "MALE" ? "MALE" : "";
  const weightTier = Invariants.normalizeWeightTier(data.weightTier);
  const lossCount = Math.floor(Number(data.lossCount));

  if (!gender) throw new Error("请选择有效的公母规格");
  if (!weightTier) throw new Error("请选择有效的重量规格");
  if (!Number.isFinite(lossCount) || lossCount <= 0) throw new Error("损耗数量必须大于 0");

  const transactionResult = await prisma.$transaction(async (tx) => {
    const stock = await getColdStorageStock(gender, weightTier, tx);
    if (lossCount > stock.availableCount) {
      throw new Error(`损耗数量 (${lossCount} 只) 不能超过当前可发库存 (${stock.availableCount} 只)`);
    }

    const result = Invariants.calculateLoss({
      bookInPool: stock.availableCount,
      physicalCount: stock.availableCount - lossCount,
      inPoolCount: stock.totalQualified,
      historicalLoss: stock.totalLoss,
    });
    if (!result.valid) throw new Error(result.reason);

    const reason = data.reason?.trim() || "发货环节损耗盘点";
    if (result.isException && !data.reason?.trim()) {
      throw new Error("累计出库损耗率超 5%，请详细填写损耗原因");
    }

    const allocations = await allocateColdStockFIFO(gender, weightTier, lossCount, tx);
    for (const allocation of allocations) {
      await tx.outboundLossRecord.create({
        data: {
          gender,
          weightTier,
          count: allocation.count,
          reason,
          coldLogId: allocation.coldLogId,
          operatorId: user.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        operatorId: user.id,
        action: "OUTBOUND_LOSS_REGISTER",
        entityType: "OUTBOUND_STOCK",
        entityId: `${gender}_${weightTier}`,
        details: JSON.stringify({
          gender,
          weightTier,
          bookCount: stock.availableCount,
          physicalCount: stock.availableCount - lossCount,
          lossCount,
          cumulativeLoss: result.totalLoss,
          lossRate: result.lossRate,
          reason,
          fifoAllocations: allocations,
        }),
      },
    });

    return { availableAfter: stock.availableCount - lossCount };
  }, { isolationLevel: "Serializable" });

  // 库存扣减已经提交后，不让页面缓存刷新失败把本次业务结果伪装成“登记失败”，
  // 否则用户重试可能造成同一笔损耗重复登记。
  try {
    revalidatePath("/outbound");
    revalidatePath("/cold-storage");
    revalidatePath("/ledgers");
    revalidatePath("/");
  } catch {}

  return transactionResult;
}

// 辅助：生成当日唯一的出库单号
async function nextOutboundCode(tx: any): Promise<string> {
  const prefix = `CK-${getBeijingDateStr()}-`;
  const count = await tx.outboundOrder.count({ where: { code: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

/**
 * 门店订单出库申请 (合单)
 */
export async function createStoreOutboundAction(data: {
  storeId: string;
  orderIds: string[];
  transportCompany?: string;
  contactName: string;
  contactPhone: string;
  applicantId: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);

  const contactName = data.contactName.trim();
  const contactPhone = data.contactPhone.trim();
  if (!contactName) throw new Error("请填写联系人");
  if (!/^[0-9+\-\s()]{6,20}$/.test(contactPhone)) throw new Error("请填写正确的联系方式");

  return await prisma.$transaction(async (tx) => {
    const store = await tx.store.findUniqueOrThrow({
      where: { id: data.storeId },
      include: { channel: true },
    });

    const orders = await tx.order.findMany({
      where: { id: { in: data.orderIds }, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

    if (orders.length === 0) {
      throw new Error("请至少选择一个待发货的门店订单");
    }

    const totalCrabCount = orders.reduce((sum, order) => sum + order.count, 0);
    const { lines, firstAllocation } = await buildFifoOutboundLines(orders, tx);
    const orderCode = await nextOutboundCode(tx);

    const outboundOrder = await tx.outboundOrder.create({
      data: {
        code: orderCode,
        coldLogId: firstAllocation.coldLogId,
        batchId: firstAllocation.sourceBatchId,
        storeId: data.storeId,
        channelId: store.channelId,
        outboundCount: totalCrabCount,
        channelOrderCount: totalCrabCount,
        logisticsNo: "门店冷链专车自配",
        transportCompany: data.transportCompany?.trim() || null,
        contactName,
        contactPhone,
        status: "PENDING",
        applicantId: data.applicantId,
        lines: { create: lines },
      },
    });

    // 标记订单为已发货
    await tx.order.updateMany({
      where: { id: { in: data.orderIds } },
      data: {
        status: "SHIPPED",
      },
    });

    await tx.auditLog.create({
      data: {
        operatorId: data.applicantId,
        action: "STORE_OUTBOUND_REQUEST",
        entityType: "OUTBOUND_ORDER",
        entityId: outboundOrder.id,
        details: JSON.stringify({
          orderCode,
          storeName: store.name,
          totalCrabCount,
          ordersCount: orders.length,
          allocationMode: "FIFO_BY_SOURCE_BATCH",
          fifoAllocations: lines.map((line) => ({ orderNo: line.orderNo, coldLogId: line.coldLogId, count: line.count })),
        }),
      },
    });

    try {
      revalidatePath("/outbound");
      revalidatePath("/orders");
      revalidatePath("/approvals");
    } catch {}

    return outboundOrder;
  }, { isolationLevel: "Serializable" });
}

/**
 * 提蟹订单统一出库申请 (一键全选合单)
 */
export async function createCardUnifiedOutboundAction(data: {
  orderIds: string[];
  transportCompany?: string;
  applicantId: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  return await prisma.$transaction(async (tx) => {
    const orders = await tx.order.findMany({
      where: { id: { in: data.orderIds }, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

    if (orders.length === 0) {
      throw new Error("请至少选择一个待发货的提蟹订单");
    }

    // 查找山姆默认总店
    const defaultStore = await tx.store.findFirst({
      include: { channel: true },
    });
    if (!defaultStore) throw new Error("未找到默认渠道门店");

    const totalCrabCount = orders.reduce((sum, order) => sum + order.count, 0);
    const { lines, firstAllocation } = await buildFifoOutboundLines(
      orders,
      tx,
      () => ({ expressCompany: data.transportCompany || "顺丰速运" })
    );
    const orderCode = await nextOutboundCode(tx);

    const outboundOrder = await tx.outboundOrder.create({
      data: {
        code: orderCode,
        coldLogId: firstAllocation.coldLogId,
        batchId: firstAllocation.sourceBatchId,
        type: "CRAB_CARD",
        storeId: defaultStore.id,
        channelId: defaultStore.channelId,
        outboundCount: totalCrabCount,
        channelOrderCount: totalCrabCount,
        logisticsNo: "发货后回填",
        status: "PENDING",
        applicantId: data.applicantId,
        lines: { create: lines },
      },
    });

    await tx.order.updateMany({
      where: { id: { in: data.orderIds } },
      data: {
        status: "SHIPPED",
      },
    });

    await tx.auditLog.create({
      data: {
        operatorId: data.applicantId,
        action: "CARD_UNIFIED_OUTBOUND_REQUEST",
        entityType: "OUTBOUND_ORDER",
        entityId: outboundOrder.id,
        details: JSON.stringify({
          orderCode,
          totalCrabCount,
          ordersCount: orders.length,
          allocationMode: "FIFO_BY_SOURCE_BATCH",
          fifoAllocations: lines.map((line) => ({ orderNo: line.orderNo, coldLogId: line.coldLogId, count: line.count })),
        }),
      },
    });

    revalidatePath("/outbound");
    revalidatePath("/orders");
    revalidatePath("/approvals");

    return outboundOrder;
  }, { isolationLevel: "Serializable" });
}

/**
 * 批量导入 / 回填快递运单号
 */
export async function batchImportLogisticsAction(data: {
  outboundOrderId: string;
  records: Array<{ orderNo: string; expressCompany: string; waybillNo: string }>;
  operatorId: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  return await prisma.$transaction(async (tx) => {
    let successCount = 0;

    for (const r of data.records) {
      if (!r.waybillNo?.trim() || !r.orderNo?.trim()) continue;

      const orderNoTrimmed = r.orderNo.trim();
      const companyTrimmed = r.expressCompany?.trim() || "顺丰速运";
      const waybillTrimmed = r.waybillNo.trim();

      const updatedLine = await tx.outboundLine.updateMany({
        where: {
          outboundOrderId: data.outboundOrderId,
          orderNo: orderNoTrimmed,
        },
        data: {
          expressCompany: companyTrimmed,
          waybillNo: waybillTrimmed,
        },
      });

      if (updatedLine.count > 0) {
        successCount += updatedLine.count;
      }
    }

    const allLines = await tx.outboundLine.findMany({
      where: { outboundOrderId: data.outboundOrderId },
    });
    const filledCount = allLines.filter((l) => Boolean(l.waybillNo)).length;
    const firstWithWaybill = allLines.find((l) => Boolean(l.waybillNo));

    if (firstWithWaybill) {
      const summaryText =
        filledCount === allLines.length
          ? `${firstWithWaybill.expressCompany || "顺丰冷链"} (${firstWithWaybill.waybillNo} 等${allLines.length}单)`
          : `部分回填 (${filledCount}/${allLines.length}单)`;

      await tx.outboundOrder.update({
        where: { id: data.outboundOrderId },
        data: {
          logisticsNo: summaryText,
          logisticsUpdatedAt: new Date(),
          logisticsUpdatedBy: data.operatorId,
        },
      });
    }

    revalidatePath("/outbound");
    revalidatePath("/orders");
    revalidatePath("/trace");

    return { success: true, count: successCount, message: `成功回填 ${successCount} 条物流运单号` };
  });
}

/**
 * 单行手动修改物流单号
 */
export async function updateSingleLineLogisticsAction(data: {
  lineId: string;
  expressCompany: string;
  waybillNo: string;
  operatorId: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  return await prisma.$transaction(async (tx) => {
    const line = await tx.outboundLine.update({
      where: { id: data.lineId },
      data: {
        expressCompany: data.expressCompany.trim() || "顺丰速运",
        waybillNo: data.waybillNo.trim(),
      },
      include: { outboundOrder: { include: { lines: true } } },
    });

    const allLines = line.outboundOrder.lines;
    const filledCount = allLines.filter((l) => Boolean(l.waybillNo)).length;
    const firstWithWaybill = allLines.find((l) => Boolean(l.waybillNo));

    if (firstWithWaybill) {
      const summaryText =
        filledCount === allLines.length
          ? `${firstWithWaybill.expressCompany || "顺丰冷链"} (${firstWithWaybill.waybillNo} 等${allLines.length}单)`
          : `部分回填 (${filledCount}/${allLines.length}单)`;

      await tx.outboundOrder.update({
        where: { id: line.outboundOrderId },
        data: {
          logisticsNo: summaryText,
          logisticsUpdatedAt: new Date(),
          logisticsUpdatedBy: data.operatorId,
        },
      });
    }

    revalidatePath("/outbound");

    return { success: true, line };
  });
}

/**
 * 兼容旧单票提交与重提 Action
 */
export async function createOutboundOrderAction(data: {
  batchId: string;
  storeId: string;
  outboundCount: number;
  channelOrderCount?: number;
  applicantId: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  const channelOrderCount = data.channelOrderCount ?? data.outboundCount;
  return await prisma.$transaction(async (tx) => {
    const batch = await tx.batch.findUniqueOrThrow({
      where: { id: data.batchId },
    });

    if (batch.status === "FROZEN") {
      throw new Error("批次已冻结，无法申请出库");
    }

    const store = await tx.store.findUniqueOrThrow({
      where: { id: data.storeId },
      include: { channel: true },
    });

    const bookInPool = batch.inPoolCount - batch.outPoolCount - batch.lossCount;
    const outboundCheck = Invariants.checkOutbound({
      bookInPool,
      outboundCount: data.outboundCount,
      channelOrderCount,
    });

    if (!outboundCheck.valid) {
      throw new Error(outboundCheck.reason);
    }

    const orderCode = await nextOutboundCode(tx);

    const order = await tx.outboundOrder.create({
      data: {
        code: orderCode,
        batchId: data.batchId,
        storeId: data.storeId,
        channelId: store.channelId,
        outboundCount: data.outboundCount,
        channelOrderCount,
        logisticsNo: "冷链专车 (苏E·88888)",
        status: "PENDING",
        applicantId: data.applicantId,
      },
    });

    try {
      revalidatePath("/outbound");
      revalidatePath("/approvals");
    } catch {}
    return order;
  });
}

export async function resubmitOutboundOrderAction(data: {
  orderId: string;
  storeId: string;
  outboundCount: number;
  applicantId: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  return await prisma.$transaction(async (tx) => {
    const order = await tx.outboundOrder.findUniqueOrThrow({
      where: { id: data.orderId },
      include: { batch: true, lines: { select: { count: true } } },
    });

    if (order.status !== "REJECTED") {
      throw new Error("只有已驳回的出库单可以重新提交");
    }
    if (order.batch.status === "FROZEN") {
      throw new Error("批次已冻结，无法重新提交");
    }

    if (order.lines.length > 0) {
      const boundCount = order.lines.reduce((sum, line) => sum + line.count, 0);
      if (data.storeId !== order.storeId || data.outboundCount !== boundCount) {
        throw new Error("该出库单已绑定订单与冷库明细，重新提报时不可修改门店或数量；如需调整，请重新创建出库单");
      }
    }

    const store = await tx.store.findUniqueOrThrow({
      where: { id: data.storeId },
    });

    const updated = await tx.outboundOrder.update({
      where: { id: data.orderId },
      data: {
        storeId: data.storeId,
        channelId: store.channelId,
        outboundCount: data.outboundCount,
        channelOrderCount: data.outboundCount,
        status: "PENDING",
        rejectReason: null,
      },
    });

    try {
      revalidatePath("/outbound");
      revalidatePath("/approvals");
    } catch {}
    return updated;
  });
}

export async function updateLogisticsAction(data: {
  orderId: string;
  logisticsNo: string;
  operatorId: string;
  operatorName: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  return await prisma.$transaction(async (tx) => {
    const order = await tx.outboundOrder.update({
      where: { id: data.orderId },
      data: {
        logisticsNo: data.logisticsNo,
        logisticsUpdatedAt: new Date(),
        logisticsUpdatedBy: data.operatorName,
      },
    });

    try {
      revalidatePath("/outbound");
      revalidatePath("/ledgers");
    } catch {}
    return order;
  });
}
