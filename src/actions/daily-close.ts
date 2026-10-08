"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { aggregateTraceableColdStocks } from "@/lib/cold-stock";
import { prisma } from "@/lib/prisma";
import { formatISODate, getBeijingDayRange } from "@/lib/utils";
import { summarizeBatchItems } from "@/lib/holding-pool";

export type DailyCloseType = "POOL" | "COLD";

export async function assertDailyCloseOpen(type: DailyCloseType) {
  const action = type === "POOL" ? "DAILY_POOL_CLOSE" : "DAILY_COLD_CLOSE";
  if (await prisma.auditLog.findFirst({ where: { action, entityId: formatISODate() } })) {
    throw new Error(type === "POOL" ? "今日清池日结已完成，禁止再次入池" : "今日清库日结已完成，禁止再次入库");
  }
}

export async function completeDailyCloseAction(type: DailyCloseType) {
  try {
    const user = await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
    const beijingHour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", hour: "2-digit", hourCycle: "h23" }).format(new Date())
    );
    const businessDate = formatISODate();
    if (beijingHour < 18) {
      const dayRange = getBeijingDayRange(businessDate);
      const hasTodayOutbound = await prisma.outboundOrder.findFirst({
        where: {
          status: "APPROVED",
          outboundTime: dayRange,
        },
        select: { id: true },
      });
      if (!hasTodayOutbound) {
        return { success: false, error: "每日收尾日结需在当天有订单出库发运后或 18:00 后开放" };
      }
    }

    const action = type === "POOL" ? "DAILY_POOL_CLOSE" : "DAILY_COLD_CLOSE";
    if (await prisma.auditLog.findFirst({ where: { action, entityId: businessDate } })) {
      return { success: true };
    }

    if (type === "POOL") {
      const batches = await prisma.batch.findMany({
        where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } },
        include: { items: true },
      });
      const remaining = batches.reduce(
        (sum, b) => sum + (b.items.length ? summarizeBatchItems(b.items).remaining : Math.max(0, b.inPoolCount - b.outPoolCount - b.lossCount)),
        0
      );
      if (remaining > 0) {
        return { success: false, error: `仍有 ${remaining} 只在池活蟹，请先在【暂养监控】完成清池盘点与规格释放` };
      }
    } else {
      const pendingOutbound = await prisma.outboundOrder.count({ where: { status: "PENDING" } });
      if (pendingOutbound > 0) {
        return { success: false, error: `仍有 ${pendingOutbound} 笔出库单待审核，请先完成出库审核` };
      }

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
      if (remaining > 0) {
        return { success: false, error: `仍有 ${remaining} 只冷库库存，请先完成清库盘点与出库轧平` };
      }
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
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "日结收尾处理异常，请重试" };
  }
}
