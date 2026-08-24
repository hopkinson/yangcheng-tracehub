"use server";

import { prisma } from "@/lib/prisma";
import { Invariants } from "@/lib/invariants";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getBeijingDateStr } from "@/lib/utils";

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
        logisticsNo: "待生成",
        status: "PENDING",
        applicantId: data.applicantId,
      },
    });

    await tx.auditLog.create({
      data: {
        operatorId: data.applicantId,
        action: "OUTBOUND_REQUEST",
        entityType: "OUTBOUND_ORDER",
        entityId: order.id,
        details: JSON.stringify({ orderCode, batchCode: batch.code, outboundCount: data.outboundCount }),
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

    const bookInPool = order.batch.inPoolCount - order.batch.outPoolCount - order.batch.lossCount;
    const outboundCheck = Invariants.checkOutbound({
      bookInPool,
      outboundCount: data.outboundCount,
      channelOrderCount: data.outboundCount,
    });

    if (!outboundCheck.valid) {
      throw new Error(outboundCheck.reason);
    }

    const previousState = {
      outboundCount: order.outboundCount,
      storeId: order.storeId,
      rejectReason: order.rejectReason,
    };

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

    await tx.auditLog.create({
      data: {
        operatorId: data.applicantId,
        action: "RESUBMIT_OUTBOUND",
        entityType: "OUTBOUND_ORDER",
        entityId: order.id,
        details: JSON.stringify({
          orderCode: order.code,
          previous: previousState,
          resubmitted: { outboundCount: data.outboundCount, storeId: data.storeId, storeName: store.name },
        }),
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

    await tx.auditLog.create({
      data: {
        operatorId: data.operatorId,
        action: "LOGISTICS_UPDATE",
        entityType: "OUTBOUND_ORDER",
        entityId: order.id,
        details: JSON.stringify({ orderCode: order.code, logisticsNo: data.logisticsNo }),
      },
    });

    try {
      revalidatePath("/outbound");
      revalidatePath("/ledgers");
    } catch {}
    return order;
  });
}
