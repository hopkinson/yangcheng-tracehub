import { prisma } from "@/lib/prisma";
import { OverviewDashboard } from "@/components/dashboard/OverviewDashboard";
import { formatISODate, getBeijingDayRange } from "@/lib/utils";
import { aggregateTraceableColdStocks } from "@/lib/cold-stock";
import { getCurrentUser } from "@/lib/auth";
import { summarizeBatchItems } from "@/lib/holding-pool";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const todayStr = formatISODate();
  const todayRange = getBeijingDayRange(todayStr);

  const [
    // 1. 全局额度与大盘聚合 (数据库端轻量聚合)
    farmerAgg,
    batchAgg,
    tagClaimAgg,
    outboundAgg,
    totalOrdersCount,
    totalBatchesCount,
    totalBundleBatchesCount,
    totalSortTasksCount,
    totalOutboundOrdersCount,

    // 2. 存活与暂养池 (仅查询有效池与有效存活批次)
    liveBatches,
    pools,

    // 3. 今日业务明细 (严格按北京时间当天过滤)
    todayOrders,
    pendingOrders,
    todayBatches,
    todayTagClaims,
    pendingTagClaimsCount,
    todayBundleBatches,
    todaySortTasks,
    todayColdLogs,
    coldStores,
    todayOutboundOrders,
    pendingOutboundOrdersCount,

    // 4. 冷库规格库存与日结探活
    sortTasksForCold,
    coldLogsForCold,
    outboundLinesForCold,
    outboundLossesForCold,
    dailyCloseLogs,

    // 5. 业务预警与品控动态 (定向过滤与限制条数)
    frozenBatchesRaw,
    highLossTasksRaw,
    uncalibratedMachinesRaw,
    unbalancedTagClaimsRaw,
    qcRecordsRaw,
    currentUser,
  ] = await Promise.all([
    // 1. 聚合
    prisma.farmer.aggregate({ _sum: { quota: true } }),
    prisma.batch.aggregate({ _sum: { inPoolCount: true, outPoolCount: true, lossCount: true } }),
    prisma.tagClaim.aggregate({ where: { status: "APPROVED" }, _sum: { claimCount: true } }),
    prisma.outboundOrder.aggregate({ where: { status: "APPROVED" }, _sum: { outboundCount: true } }),
    prisma.order.count(),
    prisma.batch.count(),
    prisma.bundleBatch.count(),
    prisma.sortTask.count(),
    prisma.outboundOrder.count(),

    // 2. 在池存活批次与暂养池（仅在养状态）
    prisma.batch.findMany({
      where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } },
      select: {
        inPoolCount: true,
        outPoolCount: true,
        lossCount: true,
        items: {
          select: { inPoolCount: true, outPoolCount: true, lossCount: true },
        },
      },
    }),
    prisma.holdingPool.findMany({
      where: { code: { in: ["ZY-01", "ZY-02", "ZY-03", "ZY-04", "ZY-05", "ZY-06", "ZY-07", "ZY-08"] } },
      include: {
        batches: {
          where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } },
          select: { inPoolCount: true, outPoolCount: true, lossCount: true },
        },
        batchItems: {
          where: { batch: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
          select: { inPoolCount: true, outPoolCount: true, lossCount: true },
        },
      },
      orderBy: { code: "asc" },
    }),

    // 3. 今日数据
    prisma.order.findMany({
      where: {
        OR: [{ deliveryDate: todayRange }, { importTime: todayRange }],
      },
      select: { id: true, orderNo: true, count: true },
    }),
    prisma.order.findMany({
      where: { status: "PENDING" },
      select: { count: true },
    }),
    prisma.batch.findMany({
      where: { inPoolTime: todayRange },
      select: { inPoolCount: true, lossCount: true },
    }),
    prisma.tagClaim.findMany({
      where: { claimDate: todayRange },
      select: { claimCount: true },
    }),
    prisma.tagClaim.count({ where: { status: "PENDING" } }),
    prisma.bundleBatch.findMany({
      where: { date: todayRange },
      select: {
        status: true,
        qualifiedCount: true,
        lossCount: true,
        lines: { select: { count: true } },
      },
    }),
    prisma.sortTask.findMany({
      where: { date: todayRange },
      select: { qualifiedCount: true, lossCount: true },
    }),
    prisma.coldLog.findMany({
      where: { createdAt: todayRange, type: "INTAKE" },
      select: { count: true },
    }),
    prisma.coldStore.findMany({
      select: { id: true },
    }),
    prisma.outboundOrder.findMany({
      where: {
        status: "APPROVED",
        OR: [
          { outboundTime: todayRange },
          { approvedAt: todayRange },
          { createdAt: todayRange },
        ],
      },
      select: {
        id: true,
        outboundCount: true,
        lines: { select: { orderNo: true } },
      },
    }),
    prisma.outboundOrder.count({ where: { status: "PENDING" } }),

    // 4. 冷库库存推导所需精简数据
    prisma.sortTask.findMany({
      where: { status: "COMPLETED" },
      select: {
        id: true,
        code: true,
        gender: true,
        weightTier: true,
        bundleBatch: { select: { sourceBatchId: true } },
      },
    }),
    prisma.coldLog.findMany({
      where: { type: "INTAKE" },
      select: { id: true, count: true, type: true, sortTaskId: true },
    }),
    prisma.outboundLine.findMany({
      where: { outboundOrder: { status: { not: "REJECTED" } } },
      select: { count: true, coldLogId: true },
    }),
    prisma.outboundLossRecord.findMany({
      where: { status: { not: "REJECTED" } },
      select: { count: true, coldLogId: true, status: true, lossType: true },
    }),
    prisma.auditLog.findMany({
      where: {
        action: { in: ["DAILY_POOL_CLOSE", "DAILY_COLD_CLOSE"] },
        createdAt: todayRange,
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),

    // 5. 业务预警与最新品控
    prisma.batch.findMany({
      where: { OR: [{ status: "FROZEN" }, { isException: true }] },
      select: { id: true, code: true, exceptionReason: true, lossReason: true, inPoolTime: true },
    }),
    prisma.sortTask.findMany({
      where: { status: "COMPLETED", lossRate: { gt: 5.0 } },
      select: { id: true, code: true, lossRate: true, lossCount: true, inputCount: true, date: true },
    }),
    prisma.sortMachine.findMany({
      where: { lastCalibrationStatus: "EXCEPTION" },
      select: { id: true, code: true, name: true },
    }),
    prisma.tagClaim.findMany({
      where: { status: "APPROVED", isBalanced: false },
      include: { farmer: { select: { name: true } } },
    }),
    prisma.qCRecord.findMany({
      orderBy: { checkTime: "desc" },
      take: 20,
    }),
    getCurrentUser(),
  ]);

  // 1. 额度与全链累计统计
  const totalQuota = farmerAgg._sum.quota || 0;
  const totalInPool = batchAgg._sum.inPoolCount || 0;
  const totalLiveInPool = liveBatches.reduce(
    (sum, b) =>
      sum +
      (b.items.length
        ? summarizeBatchItems(b.items).remaining
        : Math.max(0, b.inPoolCount - b.outPoolCount - b.lossCount)),
    0
  );

  const totalTagClaimed = tagClaimAgg._sum.claimCount || 0;
  const totalOutboundApproved = outboundAgg._sum.outboundCount || 0;

  // 2. 环节指标计算
  const todayOriginalOrdersCount = new Set(todayOrders.map((o) => o.orderNo || o.id)).size;
  const pendingDeliveryTotalCount = pendingOrders.reduce((s, o) => s + o.count, 0);

  const todayInPoolTotalCount = todayBatches.reduce((s, b) => s + b.inPoolCount, 0);
  const todayPoolLossCount = todayBatches.reduce((s, b) => s + (b.lossCount || 0), 0);
  const todayTagClaimsTotalCount = todayTagClaims.reduce((s, c) => s + c.claimCount, 0);

  // 暂养池展示 (ZY-01 ~ ZY-08)
  const activePools = pools.map((p) => {
    const itemIn = p.batchItems.reduce((s, i) => s + i.inPoolCount, 0);
    const itemOut = p.batchItems.reduce((s, i) => s + i.outPoolCount, 0);
    const itemLoss = p.batchItems.reduce((s, i) => s + i.lossCount, 0);
    const itemLive = Math.max(0, itemIn - itemOut - itemLoss);

    const directIn = p.batches.reduce((s, b) => s + b.inPoolCount, 0);
    const directOut = p.batches.reduce((s, b) => s + b.outPoolCount, 0);
    const directLoss = p.batches.reduce((s, b) => s + b.lossCount, 0);
    const directLive = Math.max(0, directIn - directOut - directLoss);

    const totalLive = p.batchItems.length > 0 ? itemLive : directLive;

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      currentGender: p.currentGender,
      currentWeightTier: p.currentWeightTier,
      liveCount: totalLive,
    };
  });

  // 捆扎
  const todayBundleTotalCount = todayBundleBatches.reduce(
    (s, b) => s + (b.qualifiedCount || b.lines.reduce((ls, l) => ls + l.count, 0)),
    0
  );
  const todayBundleLossCount = todayBundleBatches.reduce((s, b) => s + (b.lossCount || 0), 0);
  const todayBundleDoneCount = todayBundleBatches.filter((b) => b.status === "COMPLETED").length;

  // 分拣
  const todaySortQualifiedCount = todaySortTasks.reduce((s, t) => s + t.qualifiedCount, 0);
  const todaySortLossCount = todaySortTasks.reduce((s, t) => s + t.lossCount, 0);

  // 预冷
  const todayColdIntakeCount = todayColdLogs.reduce((s, l) => s + l.count, 0);
  const todayColdBatchesCount = todayColdLogs.length;

  // 冷库即时可用库存
  const totalColdStockCount = aggregateTraceableColdStocks({
    sortTasks: sortTasksForCold,
    coldLogs: coldLogsForCold,
    outboundLines: outboundLinesForCold,
    outboundLosses: outboundLossesForCold,
    defaultSpecs: [],
  }).reduce((sum, stock) => sum + stock.available, 0);

  // 出库
  const todayOutboundTotalCount = todayOutboundOrders.reduce((s, o) => s + o.outboundCount, 0);
  const todayOutboundOriginalOrdersCount = new Set(
    todayOutboundOrders.flatMap((o) => o.lines.map((l) => l.orderNo || o.id))
  ).size;

  const poolCloseCompleted = dailyCloseLogs.some((log) => log.action === "DAILY_POOL_CLOSE");
  const coldCloseCompleted = dailyCloseLogs.some((log) => log.action === "DAILY_COLD_CLOSE");

  const beijingHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", hour: "2-digit", hourCycle: "h23" }).format(new Date())
  );
  const isClosingTime = beijingHour >= 18 || todayOutboundOrders.length > 0;

  // 3. 业务预警
  const frozenBatches = frozenBatchesRaw.map((b) => ({
    id: b.id,
    code: b.code,
    reason: b.exceptionReason || b.lossReason,
    time: b.inPoolTime.toISOString(),
  }));

  const highLossTasks = highLossTasksRaw.map((t) => ({
    id: t.id,
    code: t.code,
    lossRate: t.lossRate,
    lossCount: t.lossCount,
    inputCount: t.inputCount,
    time: t.date.toISOString(),
  }));

  const uncalibratedMachines = uncalibratedMachinesRaw.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
  }));

  const unbalancedTagClaims = unbalancedTagClaimsRaw.map((c) => {
    const accounted = (c.boundCount || 0) + (c.returnedCount || 0) + (c.scrappedCount || 0);
    return {
      id: c.id,
      code: c.code || "",
      farmerName: c.farmer?.name || "未知养殖户",
      claimCount: c.claimCount,
      accountedCount: accounted,
      diff: c.claimCount - accounted,
      claimDate: c.claimDate.toISOString(),
    };
  });

  const serializedQCRecords = qcRecordsRaw.map((q) => ({
    id: q.id,
    code: q.code,
    cat: q.cat,
    refType: q.refType,
    refId: q.refId,
    title: q.title,
    checkTime: q.checkTime.toISOString(),
    result: q.result,
    conclusion: q.conclusion,
    reason: q.reason,
    uploader: q.uploader,
  }));

  return (
    <OverviewDashboard
      metrics={{
        todayOrdersCount: todayOriginalOrdersCount,
        pendingDeliveryTotalCount,
        totalOrdersCount,
        todayBatchesCount: todayBatches.length,
        todayInPoolTotalCount,
        totalBatchesCount,
        todayTagClaimsCount: todayTagClaims.length,
        todayTagClaimsTotalCount,
        totalTagClaimsCount: totalTagClaimed,
        pendingTagClaimsCount,
        todayPoolInCount: todayInPoolTotalCount,
        todayPoolLossCount,
        activePoolsCount: activePools.filter((p) => p.liveCount > 0).length,
        totalLiveInPoolCount: totalLiveInPool,
        todayBundleBatchesCount: todayBundleBatches.length,
        todayBundleTotalCount,
        todayBundleLossCount,
        todayBundleDoneCount,
        totalBundleBatchesCount,
        todaySortTasksCount: todaySortTasks.length,
        todaySortQualifiedCount,
        todaySortLossCount,
        totalSortTasksCount,
        todayColdIntakeCount,
        todayColdBatchesCount,
        activeColdStoresCount: coldStores.length,
        totalColdStockCount,
        isClosingTime,
        poolCloseCompleted,
        coldCloseCompleted,
        canCloseDaily: currentUser?.role === "WAREHOUSE_ADMIN" || currentUser?.role === "ADMIN",
        todayOutboundOrdersCount: todayOutboundOrders.length,
        todayOutboundTotalCount,
        todayOutboundOriginalOrdersCount,
        pendingOutboundOrdersCount,
        totalOutboundOrdersCount,
        totalOutboundCount: totalOutboundApproved,
        totalQuota,
        totalInPool,
        totalTagClaimed,
      }}
      activePools={activePools}
      qcRecords={serializedQCRecords}
      businessAlerts={{
        frozenBatches,
        highLossTasks,
        uncalibratedMachines,
        unbalancedTagClaims,
      }}
    />
  );
}
