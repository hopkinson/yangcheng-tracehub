import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderImportDialog } from "@/components/orders/OrderImportDialog";
import { OrderDeleteButton } from "@/components/orders/OrderDeleteButton";
import { OrderDateFilter } from "@/components/orders/OrderDateFilter";
import { ShoppingBag, Calendar, AlertTriangle, CheckCircle2, TrendingUp, Layers } from "lucide-react";
import { formatISODate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const todayStr = formatISODate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
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

  // 2. 查询当前暂养池在池存活数 (按公母+规格聚合)
  const batchItems = await prisma.batchItem.findMany({
    where: {
      batch: { status: { not: "FROZEN" } },
    },
  });

  const poolStockMap: Record<string, number> = {};
  for (const item of batchItems) {
    const key = `${item.gender}_${item.weightTier}`;
    const live = Math.max(0, item.inPoolCount - item.outPoolCount - item.lossCount);
    poolStockMap[key] = (poolStockMap[key] || 0) + live;
  }

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
                const stockKey = `${dem.gender}_${dem.weightTier}`;
                const liveStock = poolStockMap[stockKey] || 0;
                const isFullyShipped = dem.pendingCount === 0;
                const gap = dem.pendingCount > liveStock ? dem.pendingCount - liveStock : 0;

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
                      ) : (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                          可满足
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1 border-t border-border/50">
                      <div>
                        <span className="text-[11px] text-muted-foreground block">待发需求</span>
                        <span className="text-sm font-bold text-foreground">{dem.pendingCount} 只</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground block">暂养在池存活</span>
                        <span className="text-sm font-bold text-primary">{liveStock} 只</span>
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
                ? `全量订单台账（共 ${displayedOrders.length} 条需求明细）`
                : `订单台账明细（发货日：${targetDateStr}，共 ${displayedOrders.length} 条需求明细）`}
            </CardTitle>
          </div>
          {targetDateStr !== "all" && (
            <Badge variant="outline" className="text-xs font-mono">
              已过滤: {targetDateStr}
            </Badge>
          )}
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-mono">
              <tr>
                <th className="px-3 py-2.5 font-medium">系统单号 / 批次</th>
                <th className="px-3 py-2.5 font-medium">原始单号 / 客户</th>
                <th className="px-3 py-2.5 font-medium">类型</th>
                <th className="px-3 py-2.5 font-medium">规格型号明细</th>
                <th className="px-3 py-2.5 font-medium">需求只数</th>
                <th className="px-3 py-2.5 font-medium">计划发货日</th>
                <th className="px-3 py-2.5 font-medium">状态</th>
                <th className="px-3 py-2.5 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    {targetDateStr === "all"
                      ? "暂无订单数据，请点击右上角「Excel 批量导入订单」"
                      : `所选发货日期（${targetDateStr}）暂无订单明细，可点击「全部」切换查看`}
                  </td>
                </tr>
              ) : (
                displayedOrders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2.5 font-mono">
                      <div className="font-bold text-foreground">{order.code}</div>
                      <div className="text-[10px] text-muted-foreground">{order.importId}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-medium text-foreground">{order.orderNo}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{order.storeName}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-[10px]">
                        {order.type === "CRAB_CARD" ? "蟹卡提货" : "门店订单"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-primary">
                        {order.gender === "FEMALE" ? "母蟹" : "公蟹"} {order.weightTier}
                      </span>
                      {order.specModel && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[160px]" title={order.specModel}>
                          原始: {order.specModel}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-foreground">{order.count} 只</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">
                      {formatISODate(order.deliveryDate)}
                    </td>
                    <td className="px-3 py-2.5">
                      {order.status === "SHIPPED" ? (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                          已发货
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                          待发货
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {order.status === "PENDING" && (
                        <OrderDeleteButton importId={order.importId} orderNo={order.orderNo} />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
