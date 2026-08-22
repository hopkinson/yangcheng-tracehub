import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OutboundOrderDialog } from "@/components/forms/OutboundOrderDialog";
import { LogisticsBackfillDialog } from "@/components/forms/LogisticsBackfillDialog";
import { ResubmitOutboundDialog } from "@/components/forms/ResubmitOutboundDialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { StaggerContainer, FadeIn } from "@/components/motion/MotionWrapper";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OutboundPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 10);

  const [currentUser, totalOrders, orders, batches, stores] = await Promise.all([
    getCurrentUser(),
    prisma.outboundOrder.count(),
    prisma.outboundOrder.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        batch: { include: { farmer: true, pool: true } },
        store: { include: { channel: true } },
        channel: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.batch.findMany({
      where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } },
      include: { farmer: true, pool: true },
    }),
    prisma.store.findMany({
      where: { isActive: true },
      include: { channel: true },
    }),
  ]);

  const currentUserId = currentUser?.id || "";
  const currentUserName = currentUser?.fullName || "管理员";
  const isWarehouseOrAdmin = currentUser?.role === "WAREHOUSE_ADMIN" || currentUser?.role === "ADMIN";

  const batchOptions = batches.map((b) => ({
    id: b.id,
    code: b.code,
    gender: b.gender,
    weightTier: b.weightTier,
    farmer: { name: b.farmer.name },
    pool: { code: b.pool.code },
    liveInPool: b.inPoolCount - b.outPoolCount - b.lossCount,
  }));

  return (
    <StaggerContainer className="flex flex-col gap-6">
      <FadeIn direction="down" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">出库管理</h1>
          <p className="text-xs text-muted-foreground">打包绑扣出库与渠道订单发运核销</p>
        </div>
        {isWarehouseOrAdmin && (
          <OutboundOrderDialog batches={batchOptions} stores={stores} userId={currentUserId} />
        )}
      </FadeIn>

      <FadeIn>
        <Card>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[140px]">出库单号与时间</TableHead>
                    <TableHead className="min-w-[180px]">批次与来源暂养池</TableHead>
                    <TableHead className="min-w-[180px]">发往门店与渠道</TableHead>
                    <TableHead className="w-[150px]">出库数量 / 渠道订单</TableHead>
                    <TableHead className="w-[160px]">物流单号与状态</TableHead>
                    <TableHead className="text-right w-[140px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const dateObj = new Date(order.createdAt);
                    return (
                      <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                        {/* 1. 出库单与时间 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono font-bold text-foreground text-xs">
                              {order.code}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {dateObj.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}{" "}
                              {dateObj.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </TableCell>

                        {/* 2. 来源与仓位 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 font-medium">
                              <span className="text-sm font-semibold">{order.batch.farmer.name}</span>
                              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 border-primary/40 text-primary bg-primary/5">
                                {order.batch.pool.code}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                              <span>{order.batch.code}</span>
                              <span>·</span>
                              <span>{order.batch.gender === "MALE" ? "公" : "母"}{order.batch.weightTier}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 3. 发往门店与渠道 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-0.5 items-start">
                            <span className="font-medium text-foreground text-sm">
                              {order.store.name}
                            </span>
                            <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0 h-4 bg-muted/60">
                              {order.channel.name}
                            </Badge>
                          </div>
                        </TableCell>

                        {/* 4. 发运与核销 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-baseline gap-1">
                              <span className="font-mono font-bold text-primary text-base leading-tight">
                                {order.outboundCount.toLocaleString()}
                              </span>
                              <span className="text-xs text-muted-foreground">只</span>
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              订单核销 {order.channelOrderCount.toLocaleString()} 只
                            </span>
                          </div>
                        </TableCell>

                        {/* 5. 物流与状态 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-1 items-start">
                            {order.logisticsNo && order.logisticsNo !== "待生成" ? (
                              <span className="font-mono font-semibold text-foreground text-xs">
                                {order.logisticsNo}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                待录运单
                              </span>
                            )}

                            <Badge
                              variant={
                                order.status === "APPROVED"
                                  ? "default"
                                  : order.status === "REJECTED"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className={cn(
                                "font-normal text-xs py-0.5",
                                order.status === "PENDING" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                                order.status === "APPROVED" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              )}
                            >
                              {order.status === "PENDING" && (
                                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5 inline-block" />
                              )}
                              {order.status === "APPROVED"
                                ? "已出库"
                                : order.status === "REJECTED"
                                ? "已驳回"
                                : "待审核"}
                            </Badge>
                            {order.status === "REJECTED" && order.rejectReason && (
                              <span className="text-[10px] text-destructive max-w-[140px] truncate" title={`驳回原因: ${order.rejectReason}`}>
                                原因: {order.rejectReason}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 6. 操作 */}
                        <TableCell className="text-right align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            {order.status === "APPROVED" && isWarehouseOrAdmin && (
                              <LogisticsBackfillDialog
                                order={order}
                                userId={currentUserId}
                                userName={currentUserName}
                              />
                            )}
                            {order.status === "REJECTED" && isWarehouseOrAdmin && (
                              <ResubmitOutboundDialog
                                order={order}
                                stores={stores}
                                userId={currentUserId}
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination total={totalOrders} page={page} pageSize={pageSize} />
          </CardContent>
        </Card>
      </FadeIn>
    </StaggerContainer>
  );
}
