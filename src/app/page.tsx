import { prisma } from "@/lib/prisma";
import { OverviewDashboard } from "@/components/dashboard/OverviewDashboard";

export const dynamic = "force-dynamic";

const TODAY_STR = new Date().toISOString().slice(0, 10);
const isTodayOrDemo = (d: Date | string | null | undefined): boolean => {
  if (!d) return false;
  const s = (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
  return s === "2026-09-21" || s === TODAY_STR;
};

export default async function DashboardPage() {
  const [
    farmers,
    batches,
    pools,
    tagClaims,
    bundleBatches,
    sortTasks,
    sortMachines,
    coldStores,
    coldLogs,
    orders,
    outboundOrders,
    qcRecords,
  ] = await Promise.all([
    prisma.farmer.findMany(),
    prisma.batch.findMany({ include: { pool: true, farmer: true, items: true } }),
    prisma.holdingPool.findMany({ include: { batches: true, batchItems: true }, orderBy: { code: "asc" } }),
    prisma.tagClaim.findMany({ orderBy: { claimDate: "desc" } }),
    prisma.bundleBatch.findMany({ include: { lines: true, group: true } }),
    prisma.sortTask.findMany({ include: { machine: true } }),
    prisma.sortMachine.findMany(),
    prisma.coldStore.findMany({ include: { logs: true } }),
    prisma.coldLog.findMany(),
    prisma.order.findMany(),
    prisma.outboundOrder.findMany({ include: { store: true, lines: true } }),
    prisma.qCRecord.findMany({ orderBy: { checkTime: "desc" } }),
  ]);

  // 1. 额度与全链累计统计
  const totalQuota = farmers.reduce((sum, f) => sum + f.quota, 0);
  const totalInPool = batches.reduce((sum, b) => sum + b.inPoolCount, 0);
  const totalOutPool = batches.reduce((sum, b) => sum + b.outPoolCount, 0);
  const totalLoss = batches.reduce((sum, b) => sum + b.lossCount, 0);
  const totalLiveInPool = Math.max(0, totalInPool - totalOutPool - totalLoss);

  const totalTagClaimed = tagClaims
    .filter((c) => c.status === "APPROVED")
    .reduce((sum, c) => sum + c.claimCount, 0);

  const totalOutboundApproved = outboundOrders
    .filter((o) => o.status === "APPROVED")
    .reduce((sum, o) => sum + o.outboundCount, 0);

  // 2. 8 张环节卡细分指标（当日 / 累计 / 待办）
  // 1. 订单
  const todayOrders = orders.filter((o) => isTodayOrDemo(o.deliveryDate) || isTodayOrDemo(o.importTime));
  const pendingOrders = orders.filter((o) => o.status === "PENDING");
  const pendingDeliveryTotalCount = pendingOrders.reduce((s, o) => s + o.count, 0);

  // 2. 原料
  const todayBatches = batches.filter((b) => isTodayOrDemo(b.inPoolTime));
  const todayInPoolTotalCount = todayBatches.reduce((s, b) => s + b.inPoolCount, 0);

  // 3. 蟹扣申领
  const todayTagClaims = tagClaims.filter((c) => isTodayOrDemo(c.claimDate));
  const todayTagClaimsTotalCount = todayTagClaims.reduce((s, c) => s + c.claimCount, 0);
  const pendingTagClaimsCount = tagClaims.filter((c) => c.status === "PENDING").length;

  // 4. 暂养与在池推导（仅展示正式暂养池 ZY-01 ~ ZY-08）
  const activePools = pools
    .filter((p) => /^ZY-0[1-8]$/.test(p.code))
    .map((p) => {
      const itemIn = p.batchItems.reduce((s, i) => s + i.inPoolCount, 0);
      const itemOut = p.batchItems.reduce((s, i) => s + i.outPoolCount, 0);
      const itemLoss = p.batchItems.reduce((s, i) => s + i.lossCount, 0);
      const itemLive = Math.max(0, itemIn - itemOut - itemLoss);

      const directIn = p.batches.reduce((s, b) => s + b.inPoolCount, 0);
      const directOut = p.batches.reduce((s, b) => s + b.outPoolCount, 0);
      const directLoss = p.batches.reduce((s, b) => s + b.lossCount, 0);
      const directLive = Math.max(0, directIn - directOut - directLoss);

      const totalLive = Math.max(itemLive, directLive);

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        currentGender: p.currentGender,
        currentWeightTier: p.currentWeightTier,
        liveCount: totalLive,
        hasCrab: true,
      };
    });

  const todayPoolInCount = todayInPoolTotalCount;

  // 5. 捆扎
  const todayBundleBatches = bundleBatches.filter((b) => isTodayOrDemo(b.date));
  const todayBundleTotalCount = todayBundleBatches.reduce(
    (s, b) => s + b.lines.reduce((ls, l) => ls + l.count, 0),
    0
  );
  const todayBundleDoneCount = todayBundleBatches.filter((b) => b.status === "COMPLETED").length;

  // 6. 分拣
  const todaySortTasks = sortTasks.filter((t) => isTodayOrDemo(t.date));
  const todaySortQualifiedCount = todaySortTasks.reduce((s, t) => s + t.qualifiedCount, 0);
  const todaySortLossCount = todaySortTasks.reduce((s, t) => s + t.lossCount, 0);

  // 7. 预冷
  const todayColdLogs = coldLogs.filter((l) => isTodayOrDemo(l.createdAt) && l.type === "INTAKE");
  const todayColdIntakeCount = todayColdLogs.reduce((s, l) => s + l.count, 0);
  const totalQualifiedSorted = sortTasks
    .filter((t) => t.status === "COMPLETED")
    .reduce((s, t) => s + t.qualifiedCount, 0);
  const totalColdStockCount = Math.max(0, totalQualifiedSorted - totalOutboundApproved);

  // 8. 出库
  const todayOutboundOrders = outboundOrders.filter((o) => isTodayOrDemo(o.createdAt));
  const todayOutboundTotalCount = todayOutboundOrders.reduce((s, o) => s + o.outboundCount, 0);
  const pendingOutboundOrdersCount = outboundOrders.filter((o) => o.status === "PENDING").length;

  // 3. 业务预警数据采集
  const frozenBatches = batches
    .filter((b) => b.status === "FROZEN" || b.isException)
    .map((b) => ({
      id: b.id,
      code: b.code,
      reason: b.exceptionReason || b.lossReason,
      time: b.inPoolTime.toISOString(),
    }));

  const highLossTasks = sortTasks
    .filter((t) => t.status === "COMPLETED" && t.lossRate > 5.0)
    .map((t) => ({
      id: t.id,
      code: t.code,
      lossRate: t.lossRate,
      lossCount: t.lossCount,
      inputCount: t.inputCount,
      time: t.date.toISOString(),
    }));

  const uncalibratedMachines = sortMachines
    .filter((m) => m.lastCalibrationStatus === "EXCEPTION")
    .map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
    }));

  const unbalancedTagClaims = tagClaims
    .filter((c) => c.status === "APPROVED" && !c.isBalanced)
    .map((c) => {
      const farmer = farmers.find((f) => f.id === c.farmerId);
      const accounted = (c.boundCount || 0) + (c.returnedCount || 0) + (c.scrappedCount || 0);
      return {
        id: c.id,
        code: c.code || "",
        farmerName: farmer?.name || "未知养殖户",
        claimCount: c.claimCount,
        accountedCount: accounted,
        diff: c.claimCount - accounted,
        claimDate: c.claimDate.toISOString(),
      };
    });

  // 序列化 QC 记录供客户端组件使用
  const serializedQCRecords = qcRecords.map((q) => ({
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
        todayOrdersCount: todayOrders.length,
        pendingDeliveryTotalCount,
        totalOrdersCount: orders.length,
        todayBatchesCount: todayBatches.length,
        todayInPoolTotalCount,
        totalBatchesCount: batches.length,
        todayTagClaimsCount: todayTagClaims.length,
        todayTagClaimsTotalCount,
        totalTagClaimsCount: totalTagClaimed,
        pendingTagClaimsCount,
        todayPoolInCount,
        activePoolsCount: activePools.length,
        totalLiveInPoolCount: totalLiveInPool,
        todayBundleBatchesCount: todayBundleBatches.length,
        todayBundleTotalCount,
        todayBundleDoneCount,
        totalBundleBatchesCount: bundleBatches.length,
        todaySortTasksCount: todaySortTasks.length,
        todaySortQualifiedCount,
        todaySortLossCount,
        totalSortTasksCount: sortTasks.length,
        todayColdIntakeCount,
        activeColdStoresCount: coldStores.length,
        totalColdStockCount,
        todayOutboundOrdersCount: todayOutboundOrders.length,
        todayOutboundTotalCount,
        pendingOutboundOrdersCount,
        totalOutboundOrdersCount: outboundOrders.length,
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
