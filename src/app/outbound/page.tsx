import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getTenant } from "@/config/tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StoreOutboundDialog } from "@/components/outbound/StoreOutboundDialog";
import { CardOutboundDialog } from "@/components/outbound/CardOutboundDialog";
import { LogisticsBatchImportDialog } from "@/components/outbound/LogisticsBatchImportDialog";
import { OutboundDetailDialog } from "@/components/outbound/OutboundDetailDialog";
import { ResubmitOutboundDialog } from "@/components/forms/ResubmitOutboundDialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { StaggerContainer, FadeIn } from "@/components/motion/MotionWrapper";
import { cn, formatDateTime } from "@/lib/utils";
import {
  ThermometerSnowflake,
  Truck,
  ShoppingBag,
  Store as StoreIcon,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export const dynamic = "force-dynamic";

// 规范与演示数据核心规格卡
const RECOG_SPECS = [
  { gender: "MALE", weightTier: "4.0两", label: "4.0两 公蟹" },
  { gender: "FEMALE", weightTier: "3.5两", label: "3.5两 母蟹" },
  { gender: "FEMALE", weightTier: "3.2两", label: "3.2两 母蟹" },
  { gender: "MALE", weightTier: "3.5两", label: "3.5两 公蟹" },
];

export default async function OutboundPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 10);

  const [
    currentUser,
    totalOrders,
    orders,
    stores,
    pendingOrders,
    sortTasks,
    outboundLines,
    qcRecords,
    rawBatches,
  ] = await Promise.all([
    getCurrentUser(),
    prisma.outboundOrder.count(),
    prisma.outboundOrder.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        batch: { include: { farmer: true, pool: true } },
        store: { include: { channel: true } },
        channel: true,
        lines: true,
        applicant: true,
        approver: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.store.findMany({
      where: { isActive: true },
      include: { channel: true },
    }),
    prisma.order.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sortTask.findMany({
      where: { status: "COMPLETED" },
    }),
    prisma.outboundLine.findMany({
      where: { outboundOrder: { status: { not: "REJECTED" } } },
    }),
    prisma.qCRecord.findMany({
      where: {
        cat: { in: ["PACK_INSPECT", "VEHICLE_INSPECT", "SHIP_LOG"] },
      },
      orderBy: { checkTime: "desc" },
      take: 10,
    }),
    prisma.batch.findMany({
      where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } },
      include: {
        farmer: true,
        pool: true,
        items: { include: { pool: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const currentUserId = currentUser?.id || "";
  const isWarehouseOrAdmin = currentUser?.role === "WAREHOUSE_ADMIN" || currentUser?.role === "ADMIN";

  // 格式化可供关联的原料批次信息
  const rawBatchOptions = rawBatches.map((b: any) => {
    const liveInBatch = Math.max(0, b.inPoolCount - b.outPoolCount - b.lossCount);
    const specSummary =
      b.items && b.items.length > 0
        ? b.items.map((it: any) => `${it.gender === "FEMALE" ? "母" : "公"}${it.weightTier}`).join(" / ")
        : `${b.gender === "FEMALE" ? "母" : "公"}${b.weightTier}`;
    return {
      id: b.id,
      code: b.code,
      farmerName: b.farmer?.name || "签约养殖户",
      farmerCode: b.farmer?.code || "",
      poolCode: b.pool?.code || "ZY-01",
      specSummary,
      liveCount: liveInBatch,
    };
  });

  // 计算冷库各规格可出库存：可出数量 = 已完成分拣的合格数累计 − 出库单已占用（待审核 + 已出库）
  const specStocks = RECOG_SPECS.map((spec) => {
    const qualified = sortTasks
      .filter((t: any) => t.gender === spec.gender && t.weightTier === spec.weightTier)
      .reduce((a: number, t: any) => a + t.qualifiedCount, 0);

    const used = outboundLines
      .filter((l: any) => l.gender === spec.gender && l.weightTier === spec.weightTier)
      .reduce((a: number, l: any) => a + l.count, 0);

    const available = Math.max(0, qualified - used);
    const usagePct = qualified > 0 ? Math.min(100, Math.round((used / qualified) * 100)) : 0;

    return {
      ...spec,
      qualified,
      used,
      available,
      usagePct,
    };
  });

  const pendingStoreOrders = pendingOrders.filter((o: any) => o.type !== "CRAB_CARD");
  const pendingCardOrders = pendingOrders.filter((o: any) => o.type === "CRAB_CARD");

  return (
    <StaggerContainer className="flex flex-col gap-4">
      <FadeIn direction="down" className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            出库管理
          </h1>
          <p className="text-xs text-muted-foreground">
            冷库规格化合格品出库闭环 · 支持门店多单合单出库与蟹卡提蟹统一出库
          </p>
        </div>
        {isWarehouseOrAdmin && (
          <div className="flex items-center gap-2">
            <CardOutboundDialog
              pendingCardOrders={pendingCardOrders}
              specStocks={specStocks}
              rawBatches={rawBatchOptions}
              userId={currentUserId}
            />
            <StoreOutboundDialog
              stores={stores.map((s: any) => ({ id: s.id, name: s.name, code: s.code }))}
              pendingOrders={pendingStoreOrders}
              specStocks={specStocks}
              rawBatches={rawBatchOptions}
              userId={currentUserId}
            />
          </div>
        )}
      </FadeIn>

      {/* 14.2 页首：冷库可出库库存卡 */}
      <FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {specStocks.map((stock, idx) => (
            <Card key={idx} className="border-border/80 shadow-xs">
              <CardHeader className="py-1.5 px-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ThermometerSnowflake className="size-3.5 text-primary" />
                  <CardTitle className="text-xs font-semibold">{stock.label}</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-mono">
                  占用 {stock.usagePct}%
                </Badge>
              </CardHeader>
              <CardContent className="p-2.5 space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-muted-foreground">冷库可出库存</span>
                  <div className="flex items-baseline gap-1">
                    <span className={cn("text-base font-bold font-mono", stock.available > 0 ? "text-primary" : "text-destructive")}>
                      {stock.available.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">只</span>
                  </div>
                </div>

                {/* 占用进度条：有可出=绿，罄=红 */}
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      stock.available > 0 ? "bg-emerald-500" : "bg-rose-500"
                    )}
                    style={{ width: `${Math.max(4, Math.min(100, stock.usagePct))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>分拣合格: {stock.qualified}</span>
                  <span>出库已占: {stock.used}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </FadeIn>

      {/* 14.4 出库批次台账 */}
      <FadeIn>
        <Card>
          <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Truck className="size-4 text-primary" />
              出库单列表
            </CardTitle>
            <span className="text-xs text-muted-foreground font-mono">共 {totalOrders} 笔出库批次</span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md border-b overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[140px]">出库批次号 (CK)</TableHead>
                    <TableHead className="w-[90px]">类型</TableHead>
                    <TableHead className="min-w-[150px]">去向</TableHead>
                    <TableHead className="min-w-[180px]">出库规格明细</TableHead>
                    <TableHead className="w-[110px]">总数</TableHead>
                    <TableHead className="w-[90px]">状态</TableHead>
                    <TableHead className="min-w-[160px]">物流信息</TableHead>
                    <TableHead className="w-[140px]">申请/审核时间</TableHead>
                    <TableHead className="text-right w-[140px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: any) => {
                    const isStore = order.type === "STORE_ORDER";
                    const isApproved = order.status === "APPROVED";
                    const isPending = order.status === "PENDING";
                    const isRejected = order.status === "REJECTED";

                    const lines = order.lines || [];
                    const totalLineCount = lines.length;
                    const filledLineCount = lines.filter((l: any) => Boolean(l.waybillNo)).length;
                    const isAllLogisticsFilled = totalLineCount > 0 && filledLineCount === totalLineCount;

                    // 出库明细聚合 chips
                    const specChips = Object.entries(
                      lines.reduce((acc: Record<string, number>, l: any) => {
                        const key = `${l.gender === "FEMALE" ? "母" : "公"}${l.weightTier}`;
                        acc[key] = (acc[key] || 0) + l.count;
                        return acc;
                      }, {} as Record<string, number>)
                    );

                    return (
                      <TableRow key={order.id} className="hover:bg-muted/30 transition-colors text-xs">
                        {/* 1. 出库批次号 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono font-bold text-foreground text-xs">
                              {order.code}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {order.lines?.length || 1} 笔明细合单
                            </span>
                          </div>
                        </TableCell>

                        {/* 2. 类型徽标：门店订单=湖青 / 提蟹订单=蟹橙 */}
                        <TableCell className="align-middle">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-medium px-1.5 py-0 h-5",
                              isStore
                                ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
                                : "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30"
                            )}
                          >
                            {isStore ? "门店订单" : "提蟹订单"}
                          </Badge>
                        </TableCell>

                        {/* 3. 去向 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-0.5 items-start">
                            <span className="font-medium text-foreground text-xs flex items-center gap-1">
                              {isStore ? <StoreIcon className="size-3 text-cyan-600" /> : <ShoppingBag className="size-3 text-orange-600" />}
                              {order.store?.name || order.storeName || (isStore ? getTenant().storeLabel : "蟹卡顺丰直发")}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {order.channel?.name || getTenant().channelName}
                            </span>
                          </div>
                        </TableCell>

                        {/* 4. 出库明细 (规格×数量 chip) */}
                        <TableCell className="align-middle">
                          {specChips.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {specChips.map(([specName, count]: [string, any]) => (
                                <span
                                  key={specName}
                                  className="px-1.5 py-0.5 rounded bg-muted/80 text-[10px] font-mono border"
                                >
                                  {specName} · {count}只
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-muted-foreground">
                              {order.batch?.gender === "FEMALE" ? "母蟹" : "公蟹"} {order.batch?.weightTier || "4.0两"} · {order.outboundCount}只
                            </span>
                          )}
                        </TableCell>

                        {/* 5. 总数 */}
                        <TableCell className="align-middle">
                          <div className="flex items-baseline gap-1">
                            <span className="font-mono font-bold text-primary text-sm leading-tight">
                              {order.outboundCount.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-muted-foreground">只</span>
                          </div>
                        </TableCell>

                        {/* 6. 状态 */}
                        <TableCell className="align-middle">
                          <Badge
                            variant={
                              isApproved ? "default" : isRejected ? "destructive" : "secondary"
                            }
                            className={cn(
                              "font-normal text-[11px] py-0.5",
                              isPending && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                              isApproved && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            )}
                          >
                            {isPending && (
                              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse mr-1 inline-block" />
                            )}
                            {isApproved ? "已出库" : isRejected ? "已驳回" : "待审核"}
                          </Badge>
                        </TableCell>

                        {/* 7. 物流信息 */}
                        <TableCell className="align-middle">
                          {isStore ? (
                            <span className="font-mono text-xs text-muted-foreground">门店自配</span>
                          ) : isPending ? (
                            <span className="text-xs text-muted-foreground font-mono">发货后回填</span>
                          ) : isAllLogisticsFilled ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-mono flex items-center gap-1 w-fit">
                              <CheckCircle2 className="size-3" />
                              物流已齐 · {totalLineCount} 单
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-mono flex items-center gap-1 w-fit">
                              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                              待回填 {totalLineCount - filledLineCount} 单
                            </Badge>
                          )}
                        </TableCell>

                        {/* 8. 申请/审核时间 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-0.5 font-mono text-[11px] text-muted-foreground">
                            <span>申: {formatDateTime(order.createdAt)}</span>
                            {order.approvedAt && <span>审: {formatDateTime(order.approvedAt)}</span>}
                          </div>
                        </TableCell>

                        {/* 9. 操作 */}
                        <TableCell className="text-right align-middle">
                          <div className="flex items-center justify-end gap-1">
                            <OutboundDetailDialog
                              order={{
                                id: order.id,
                                code: order.code,
                                type: order.type,
                                storeName: order.store?.name || order.storeName,
                                channelName: order.channel?.name,
                                outboundCount: order.outboundCount,
                                logisticsNo: order.logisticsNo,
                                status: order.status,
                                applicantName: order.applicant?.fullName,
                                approverName: order.approver?.fullName,
                                approvalComment: order.approvalComment,
                                approvedAt: order.approvedAt,
                                createdAt: order.createdAt,
                                lines: order.lines || [],
                              }}
                            />
                            {!isStore && (
                              <LogisticsBatchImportDialog
                                outboundId={order.id}
                                outboundCode={order.code}
                                lines={order.lines || []}
                                userId={currentUserId}
                              />
                            )}
                            {isRejected && isWarehouseOrAdmin && (
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

      {/* 14.6 出库环节品控记录 */}
      <FadeIn>
        <Card className="border-border/80">
          <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-primary" />
              <CardTitle className="text-sm font-semibold">出库环节品控记录 (包装巡检 / 发货车辆检查)</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              共 {qcRecords.length} 份质检记录
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[130px] text-xs">记录编号</TableHead>
                    <TableHead className="w-[100px] text-xs">检验类型</TableHead>
                    <TableHead className="w-[120px] text-xs">关联出库批次</TableHead>
                    <TableHead className="min-w-[200px] text-xs">检测项目与结论</TableHead>
                    <TableHead className="w-[90px] text-xs">判定结果</TableHead>
                    <TableHead className="w-[80px] text-xs">质检员</TableHead>
                    <TableHead className="w-[140px] text-xs">检测时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qcRecords.map((qc: any) => {
                    const isPack = qc.cat === "PACK_INSPECT";
                    const isVehicle = qc.cat === "VEHICLE_INSPECT";

                    return (
                      <TableRow key={qc.id} className="hover:bg-muted/30 text-xs">
                        <TableCell className="font-mono font-bold">{qc.code}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {isPack ? "包装巡检" : isVehicle ? "车辆检查" : "发运日志"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono font-medium text-primary">
                          {qc.refId}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground">{qc.title}</span>
                            <span className="text-[11px] text-muted-foreground">{qc.conclusion}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={qc.result === "QUALIFIED" ? "default" : "destructive"}
                            className={cn(
                              "text-[10px] py-0 h-4 font-normal",
                              qc.result === "QUALIFIED" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                            )}
                          >
                            {qc.result === "QUALIFIED" ? "合格" : "异常整改"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{qc.uploader}</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {formatDateTime(qc.checkTime)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </StaggerContainer>
  );
}
