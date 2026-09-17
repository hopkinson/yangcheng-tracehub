"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { aggregateTraceableColdStocks } from "@/lib/cold-stock";
import { prisma } from "@/lib/prisma";
import { formatISODate } from "@/lib/utils";
import { summarizeBatchItems } from "@/lib/holding-pool";

export type DailyCloseType = "POOL" | "COLD";

export async function assertDailyCloseOpen(type: DailyCloseType) {
  const action = type === "POOL" ? "DAILY_POOL_CLOSE" : "DAILY_COLD_CLOSE";
  if (await prisma.auditLog.findFirst({ where: { action, entityId: formatISODate() } })) {
    throw new Error(type === "POOL" ? "今日清池日结已完成，禁止再次入池" : "今日清库日结已完成，禁止再次入库");
  }
}

export async function completeDailyCloseAction(type: DailyCloseType) {
  const user = await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  const beijingHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", hour: "2-digit", hourCycle: "h23" }).format(new Date())
  );
  if (beijingHour < 18) throw new Error("每日收尾日结于 18:00 后开放");
  const action = type === "POOL" ? "DAILY_POOL_CLOSE" : "DAILY_COLD_CLOSE";
  const businessDate = formatISODate();
  if (await prisma.auditLog.findFirst({ where: { action, entityId: businessDate } })) return;

  if (type === "POOL") {
    const batches = await prisma.batch.findMany({
      where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } },
      include: { items: true },
    });
    const remaining = batches.reduce((sum, batch) => {
      if (batch.items.length > 0) {
        return sum + summarizeBatchItems(batch.items).remaining;
      }
      return sum + Math.max(0, batch.inPoolCount - batch.outPoolCount - batch.lossCount);
    }, 0);
    if (remaining > 0) throw new Error(`仍有 ${remaining} 只在池活蟹，请先完成清池盘点`);
  } else {
    const pendingOutbound = await prisma.outboundOrder.count({ where: { status: "PENDING" } });
    if (pendingOutbound > 0) throw new Error(`仍有 ${pendingOutbound} 笔出库待审核，请先完成审核`);

    const [sortTasks, coldLogs, outboundLines, outboundLosses] = await Promise.all([
      prisma.sortTask.findMany({
        where: { status: "COMPLETED" },
        include: { bundleBatch: { select: { sourceBatchId: true } } },
      }),
      prisma.coldLog.findMany({ where: { type: "INTAKE" } }),
      prisma.outboundLine.findMany({ where: { outboundOrder: { status: { not: "REJECTED" } } } }),
      prisma.outboundLossRecord.findMany(),
    ]);
    const remaining = aggregateTraceableColdStocks({ sortTasks, coldLogs, outboundLines, outboundLosses, defaultSpecs: [] })
      .reduce((sum, stock) => sum + stock.available, 0);
    if (remaining > 0) throw new Error(`仍有 ${remaining} 只冷库库存，请先完成清库盘点`);
  }

  await prisma.auditLog.create({
    data: {
      operatorId: user.id,
      action,
      entityType: "DAILY_CLOSE",
      entityId: businessDate,
    },
  });

  revalidatePath("/");
  revalidatePath(type === "POOL" ? "/pools" : "/outbound");
}
