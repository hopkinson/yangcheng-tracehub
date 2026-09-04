"use server";

import { prisma } from "@/lib/prisma";
import { Invariants } from "@/lib/invariants";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getBeijingDateStr } from "@/lib/utils";

// 辅助：获取冷库某规格实时可用库存
async function getColdStorageStock(gender: string, weightTier: string) {
  // 1. 分拣合格累计
  const qualifiedAgg = await prisma.sortTask.aggregate({
    where: { status: "COMPLETED", gender, weightTier },
    _sum: { qualifiedCount: true },
  });
  const totalQualified = qualifiedAgg._sum.qualifiedCount || 0;

  // 2. 出库单已占用累计 (排除已驳回)
  const outboundAgg = await prisma.outboundLine.aggregate({
    where: {
      gender,
      weightTier,
      outboundOrder: { status: { not: "REJECTED" } },
    },
    _sum: { count: true },
  });
  const totalUsed = outboundAgg._sum.count || 0;

  return {
    totalQualified,
    totalUsed,
    availableCount: Math.max(0, totalQualified - totalUsed),
  };
}

// 辅助：从保鲜入库批次穿透追溯原始批次
async function resolveBatchFromColdLog(
  tx: any,
  coldLogId?: string | null,
  explicitBatchId?: string | null
): Promise<string> {
  if (explicitBatchId) return explicitBatchId;
  if (coldLogId) {
    const coldLog = await tx.coldLog.findUnique({
      where: { id: coldLogId },
    });
    if (coldLog?.refId) {
      const sortTask = await tx.sortTask.findFirst({
        where: { OR: [{ code: coldLog.refId }, { id: coldLog.refId }] },
        include: {
          bundleBatch: {
            include: {
              lines: { include: { pool: { include: { batches: true } } } },
              tagClaim: { include: { farmer: { include: { batches: true } } } },
            },
          },
        },
      });
      const resolvedBatch =
        sortTask?.bundleBatch?.tagClaim?.farmer?.batches?.[0] ||
        sortTask?.bundleBatch?.lines?.[0]?.pool?.batches?.[0];
      if (resolvedBatch) {
        return resolvedBatch.id;
      }
    }
  }

  const defaultBatch = await tx.batch.findFirst({
    where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } },
    orderBy: { createdAt: "desc" },
  });
  return defaultBatch?.id || "";
}

/**
 * 门店订单出库申请 (合单)
 */
export async function createStoreOutboundAction(data: {
  storeId: string;
  orderIds: string[];
  coldLogId?: string;
  batchId?: string;
  transportCompany?: string;
  licensePlate?: string;
  applicantId: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  return await prisma.$transaction(async (tx) => {
    const store = await tx.store.findUniqueOrThrow({
      where: { id: data.storeId },
      include: { channel: true },
    });

    const orders = await tx.order.findMany({
      where: { id: { in: data.orderIds }, status: "PENDING" },
    });

    if (orders.length === 0) {
      throw new Error("请至少选择一个待发货的门店订单");
    }

    // 聚合各规格数量校验库存
    const specDemandMap: Record<string, { gender: string; weightTier: string; count: number }> = {};
    let totalCrabCount = 0;

    for (const ord of orders) {
      const key = `${ord.gender}_${ord.weightTier}`;
      if (!specDemandMap[key]) specDemandMap[key] = { gender: ord.gender, weightTier: ord.weightTier, count: 0 };
      specDemandMap[key].count += ord.count;
      totalCrabCount += ord.count;
    }

    // 针对每个规格校验冷库可用库存
    for (const demand of Object.values(specDemandMap)) {
      const stock = await getColdStorageStock(demand.gender, demand.weightTier);
      const checkRes = Invariants.checkColdStorageOutbound({
        spec: demand.weightTier,
        gender: demand.gender,
        availableCount: stock.availableCount,
        requestedCount: demand.count,
      });
      if (!checkRes.valid) throw new Error(`冷库库存不足：${checkRes.reason}`);
    }

    const dateStr = getBeijingDateStr();
    const countToday = await tx.outboundOrder.count();
    const orderCode = `CK-${dateStr}-${String(countToday + 1).padStart(3, "0")}`;

    const chosenColdLogId = data.coldLogId || null;
    const chosenBatchId = await resolveBatchFromColdLog(tx, chosenColdLogId, data.batchId);

    const outboundOrder = await tx.outboundOrder.create({
      data: {
        code: orderCode,
        coldLogId: chosenColdLogId,
        batchId: chosenBatchId,
        storeId: data.storeId,
        channelId: store.channelId,
        outboundCount: totalCrabCount,
        channelOrderCount: totalCrabCount,
        logisticsNo: data.licensePlate || "门店冷链专车自配",
        status: "PENDING",
        applicantId: data.applicantId,
        lines: {
          create: orders.map((o) => ({
            orderId: o.id,
            orderNo: o.orderNo,
            gender: o.gender,
            weightTier: o.weightTier,
            count: o.count,
          })),
        },
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
        details: JSON.stringify({ orderCode, storeName: store.name, totalCrabCount, ordersCount: orders.length }),
      },
    });

    try {
      revalidatePath("/outbound");
      revalidatePath("/orders");
      revalidatePath("/approvals");
    } catch {}

    return outboundOrder;
  });
}

/**
 * 提蟹订单统一出库申请 (一键全选合单)
 */
export async function createCardUnifiedOutboundAction(data: {
  orderIds: string[];
  coldLogId?: string;
  batchId?: string;
  transportCompany?: string;
  applicantId: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  return await prisma.$transaction(async (tx) => {
    const orders = await tx.order.findMany({
      where: { id: { in: data.orderIds }, status: "PENDING" },
    });

    if (orders.length === 0) {
      throw new Error("请至少选择一个待发货的提蟹订单");
    }

    // 查找山姆默认总店
    const defaultStore = await tx.store.findFirst({
      include: { channel: true },
    });
    if (!defaultStore) throw new Error("未找到默认渠道门店");

    // 聚合各规格数量校验库存
    const specDemandMap: Record<string, { gender: string; weightTier: string; count: number }> = {};
    let totalCrabCount = 0;

    for (const ord of orders) {
      const key = `${ord.gender}_${ord.weightTier}`;
      if (!specDemandMap[key]) specDemandMap[key] = { gender: ord.gender, weightTier: ord.weightTier, count: 0 };
      specDemandMap[key].count += ord.count;
      totalCrabCount += ord.count;
    }

    // 校验各规格冷库可用库存
    for (const demand of Object.values(specDemandMap)) {
      const stock = await getColdStorageStock(demand.gender, demand.weightTier);
      const checkRes = Invariants.checkColdStorageOutbound({
        spec: demand.weightTier,
        gender: demand.gender,
        availableCount: stock.availableCount,
        requestedCount: demand.count,
      });
      if (!checkRes.valid) throw new Error(`冷库库存不足：${checkRes.reason}`);
    }

    const dateStr = getBeijingDateStr();
    const countToday = await tx.outboundOrder.count();
    const orderCode = `CK-${dateStr}-${String(countToday + 1).padStart(3, "0")}`;

    const chosenColdLogId = data.coldLogId || null;
    const chosenBatchId = await resolveBatchFromColdLog(tx, chosenColdLogId, data.batchId);

    const outboundOrder = await tx.outboundOrder.create({
      data: {
        code: orderCode,
        coldLogId: chosenColdLogId,
        batchId: chosenBatchId,
        type: "CRAB_CARD",
        storeId: defaultStore.id,
        channelId: defaultStore.channelId,
        outboundCount: totalCrabCount,
        channelOrderCount: totalCrabCount,
        logisticsNo: "发货后回填",
        status: "PENDING",
        applicantId: data.applicantId,
        lines: {
          create: orders.map((o) => ({
            orderId: o.id,
            orderNo: o.orderNo,
            gender: o.gender,
            weightTier: o.weightTier,
            count: o.count,
            expressCompany: data.transportCompany || "顺丰速运",
          })),
        },
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
        details: JSON.stringify({ orderCode, totalCrabCount, ordersCount: orders.length }),
      },
    });

    revalidatePath("/outbound");
    revalidatePath("/orders");
    revalidatePath("/approvals");

    return outboundOrder;
  });
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

    const dateStr = getBeijingDateStr();
    const countToday = await tx.outboundOrder.count();
    const orderCode = `CK-${dateStr}-${String(countToday + 1).padStart(3, "0")}`;

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
      include: { batch: true },
    });

    if (order.batch.status === "FROZEN") {
      throw new Error("批次已冻结，无法重新提交");
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
