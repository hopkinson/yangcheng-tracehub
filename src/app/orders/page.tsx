import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderImportDialog } from "@/components/orders/OrderImportDialog";
import { OrderTable } from "@/components/orders/OrderTable";
import { OrderDateFilter } from "@/components/orders/OrderDateFilter";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { ShoppingBag, Calendar, AlertTriangle, CheckCircle2, TrendingUp, Layers } from "lucide-react";
import { formatISODate } from "@/lib/utils";
import { Invariants } from "@/lib/invariants";
import { aggregatePipelineStocks } from "@/lib/order-stock";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 10);

  const now = new Date();
  const todayStr = formatISODate(now);
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowStr = formatISODate(tomorrow);

  // 1. 查询全部订单
  const allOrders = await prisma.order.findMany({
    orderBy: [{ deliveryDate: "asc" }, { createdAt: "desc" }],
  });

  const availableDates = Array.from(
    new Set(allOrders.map((o) => formatISODate(o.deliveryDate)))
  ).sort();

  const targetDateStr = params.date || "all";

  // 联动过滤订单明细列表
  const displayedOrders =
    targetDateStr === "all"
      ? allOrders
      : allOrders.filter(
          (o: any) => formatISODate(o.deliveryDate) === targetDateStr
        );

  const totalOrders = displayedOrders.length;
  const pagedOrders = displayedOrders.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // 2. 并行查询全流程工序数据（暂养、捆扎、分拣、保鲜）
  const [
    batches,
    batchItems,
    bundleBatches,
    sortTasks,
    coldLogs,
    outboundLines,
    outboundLosses,
  ] = await Promise.all([
    prisma.batch.findMany({
      where: { status: { not: "FROZEN" } },
      select: { id: true, gender: true, weightTier: true, inPoolCount: true, outPoolCount: true, lossCount: true, status: true },
    }),
    prisma.batchItem.findMany({
      where: { batch: { status: { not: "FROZEN" } } },
      select: { batchId: true, gender: true, weightTier: true, inPoolCount: true, outPoolCount: true, lossCount: true },
    }),
    prisma.bundleBatch.findMany({
      select: { id: true, lines: { select: { gender: true, weightTier: true, count: true } } },
    }),
    prisma.sortTask.findMany({
      select: { id: true, bundleBatchId: true, gender: true, weightTier: true, inputCount: true, qualifiedCount: true },
    }),
    prisma.coldLog.findMany({
      select: { id: true, type: true, sortTaskId: true, count: true },
    }),
    prisma.outboundLine.findMany({
      where: { outboundOrder: { status: { not: "REJECTED" } } },
      select: { count: true, coldLogId: true },
    }),
    prisma.outboundLossRecord.findMany({
      select: { count: true, coldLogId: true },
    }),
  ]);

  const pipelineStocks = aggregatePipelineStocks({
    batches,
    batchItems,
    bundleBatches,
    sortTasks,
    coldLogs,
    outboundLines,
    outboundLosses,
  });

  // 3. 汇总当前所选范围的发货需求
  const demandSummaryMap: Record<
    string,
    { gender: string; weightTier: string; totalNeeded: number; shippedCount: number; pendingCount: number }
  > = {};

  for (const o of displayedOrders) {
    const key = `${o.gender}_${o.weightTier}`;
    if (!demandSummaryMap[key]) {
      demandSummaryMap[key] = {
        gender: o.gender,
        weightTier: o.weightTier,
        totalNeeded: 0,
        shippedCount: 0,
        pendingCount: 0,
      };
    }
    demandSummaryMap[key].totalNeeded += o.count;
    if (o.status === "SHIPPED") {
      demandSummaryMap[key].shippedCount += o.count;
    } else {
      demandSummaryMap[key].pendingCount += o.count;
    }
  }

  const demandSummaries = Object.values(demandSummaryMap);

  return (
    <div className="space-y-5">
      {/* 头部标题与导入入口 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ShoppingBag className="size-5 text-primary" />
          订单管理
        </h1>
        <div className="flex items-center gap-2">
          <OrderImportDialog />
        </div>
      </div>

      {/* 发货日期切换与需求缺口对照 */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="py-3 px-4 border-b bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              发货需求汇总对照（{targetDateStr === "all" ? "全部发货日" : `发货日：${targetDateStr}`}）
            </CardTitle>
          </div>
          <OrderDateFilter
            currentDate={targetDateStr}
            todayStr={todayStr}
            tomorrowStr={tomorrowStr}
            availableDates={availableDates}
          />
        </CardHeader>
        <CardContent className="p-4">
          {demandSummaries.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              所选发货日期（{targetDateStr}）暂无订单排产需求。
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {demandSummaries.map((dem) => {
                const stockKey = `${dem.gender}_${Invariants.normalizeWeightTier(dem.weightTier)}`;
                const stock = pipelineStocks[stockKey] ?? { holding: 0, bundling: 0, sorting: 0, cold: 0, total: 0 };
                const isFullyShipped = dem.pendingCount === 0;
                const gap = dem.pendingCount > stock.total ? dem.pendingCount - stock.total : 0;
                const canDirectShip = stock.cold >= dem.pendingCount;

                return (
                  <div
                    key={stockKey}
                    className="p-3 rounded-lg border bg-card/60 flex flex-col justify-between space-y-2 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground">
                        {dem.gender === "FEMALE" ? "母蟹" : "公蟹"} {dem.weightTier}
                      </span>
                      {isFullyShipped ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                          <CheckCircle2 className="size-3 mr-1" /> 已完成发货
                        </Badge>
                      ) : gap > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="size-3 mr-1" /> 缺口 {gap} 只
                        </Badge>
                      ) : canDirectShip ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                          <CheckCircle2 className="size-3 mr-1" /> 冷库现货充足
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                          流转可满足
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1 border-t border-border/50">
                      <div>
                        <span className="text-[11px] text-muted-foreground block">待发需求</span>
                        <span className="text-sm font-bold text-foreground">{dem.pendingCount} 只</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground block">全链可用总存量</span>
                        <span className="text-sm font-bold text-primary">{stock.total} 只</span>
                      </div>
                    </div>

                    {/* 四道工序协同流转明细：保鲜、分拣、捆扎、暂养 */}
                    <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground font-mono pt-1.5 border-t border-border/40 text-center">
                      <div title="保鲜库即时可用库存">
                        <span className="block text-[9px] text-muted-foreground/80">保鲜</span>
                        <span className="font-semibold text-foreground">{stock.cold}</span>
                      </div>
                      <div title="分拣合格待入冷库">
                        <span className="block text-[9px] text-muted-foreground/80">分拣</span>
                        <span className="font-semibold text-foreground">{stock.sorting}</span>
                      </div>
                      <div title="捆扎在制或待分拣">
                        <span className="block text-[9px] text-muted-foreground/80">捆扎</span>
                        <span className="font-semibold text-foreground">{stock.bundling}</span>
                      </div>
                      <div title="暂养池存活待起池">
                        <span className="block text-[9px] text-muted-foreground/80">暂养</span>
                        <span className="font-semibold text-foreground">{stock.holding}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 订单明细列表 */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="py-3 px-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              {targetDateStr === "all"
                ? `全量订单台账（共 ${totalOrders} 条需求明细）`
                : `订单台账明细（发货日：${targetDateStr}，共 ${totalOrders} 条需求明细）`}
            </CardTitle>
          </div>
          {targetDateStr !== "all" && (
            <Badge variant="outline" className="text-xs font-mono">
              已过滤: {targetDateStr}
            </Badge>
          )}
        </CardHeader>
        <OrderTable
          key={`${targetDateStr}-${page}`}
          orders={pagedOrders}
          targetDateStr={targetDateStr}
        />
        {totalOrders > 0 && (
          <div className="p-4 border-t border-border/60">
            <DataTablePagination
              total={totalOrders}
              page={page}
              pageSize={pageSize}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
