"use server";

import { prisma } from "@/lib/prisma";
import { Invariants } from "@/lib/invariants";
import { revalidatePath } from "next/cache";

export async function createOutboundOrderAction(data: {
  batchId: string;
  storeId: string;
  outboundCount: number;
  channelOrderCount: number;
  applicantId: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const batch = await tx.batch.findUniqueOrThrow({
      where: { id: data.batchId },
    });

    const store = await tx.store.findUniqueOrThrow({
      where: { id: data.storeId },
      include: { channel: true },
    });

    const bookInPool = batch.inPoolCount - batch.outPoolCount - batch.lossCount;
    const outboundCheck = Invariants.checkOutbound({
      bookInPool,
      outboundCount: data.outboundCount,
      channelOrderCount: data.channelOrderCount,
    });

    if (!outboundCheck.valid) {
      throw new Error(outboundCheck.reason);
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const countToday = await tx.outboundOrder.count();
    const orderCode = `CK-${dateStr}-${String(countToday + 1).padStart(3, "0")}`;

    const order = await tx.outboundOrder.create({
      data: {
        code: orderCode,
        batchId: data.batchId,
        storeId: data.storeId,
        channelId: store.channelId,
        outboundCount: data.outboundCount,
        channelOrderCount: data.channelOrderCount,
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

export async function updateLogisticsAction(data: {
  orderId: string;
  logisticsNo: string;
  operatorId: string;
  operatorName: string;
}) {
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
