import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagApprovalButton, OutboundApprovalButton } from "@/components/forms/ApprovalActions";
import { BatchFreezeButton } from "@/components/batches/BatchFreezeButton";
import { BatchDetailDialog } from "@/components/batches/BatchDetailDialog";
import { BatchLossHistoryDialog } from "@/components/batches/BatchLossHistoryDialog";
import { Tag, Truck, AlertTriangle, CheckCircle2, Clock, ShieldCheck, UserCheck } from "lucide-react";
import { cn, formatDateTime, formatDate, formatTime } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    type?: string;
  }>;
}) {
  const [currentUser, params] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ]);

  const activeTab = params.tab || "pending";
  const typeFilter = params.type || "ALL"; // ALL | TAG | OUTBOUND

  // 待审批查询
  const [
    pendingTagClaims,
    pendingOutboundOrders,
    processedTagClaims,
    processedOutboundOrders,
    exceptionBatches,
  ] = await Promise.all([
    prisma.tagClaim.findMany({
      where: { status: "PENDING" },
      include: {
        farmer: {
          include: {
            batches: { where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
            tagClaims: { where: { status: "APPROVED" } },
          },
        },
        applicant: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.outboundOrder.findMany({
      where: { status: "PENDING" },
      include: {
        batch: { include: { farmer: true, pool: true } },
        store: { include: { channel: true } },
        channel: true,
        applicant: true,
        lines: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    // 已处理查询
    prisma.tagClaim.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      take: 50,
      include: {
        farmer: true,
        applicant: true,
        approver: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.outboundOrder.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      take: 50,
      include: {
        batch: { include: { farmer: true } },
        store: true,
        channel: true,
        applicant: true,
        approver: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    // 损耗异常批次
    prisma.batch.findMany({
      where: {
        isException: true,
        status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND", "FROZEN"] },
      },
      include: {
        farmer: true,
        enclosure: true,
        pool: true,
        lossRecords: {
          orderBy: { createdAt: "desc" },
          include: { inspector: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const totalPendingCount = pendingTagClaims.length + pendingOutboundOrders.length;
  const processedCount = processedTagClaims.length + processedOutboundOrders.length;

  // 待办卡片统一聚合流
  const pendingTagCards = (typeFilter === "ALL" || typeFilter === "TAG")
    ? pendingTagClaims.map((claim) => {
        const activeInPool = claim.farmer.batches.reduce(
          (sum, b) => sum + (b.inPoolCount - b.outPoolCount - b.lossCount),
          0
        );
        const cumulativeClaimed = claim.farmer.tagClaims.reduce((sum, c) => sum + c.boundCount, 0);
        const remainingQuota = Math.max(0, claim.farmer.quota - cumulativeClaimed);
        const maxClaimable = Math.min(activeInPool, remainingQuota);
        const isSafe = claim.claimCount <= maxClaimable && claim.claimCount > 0;

        return {
          id: claim.id,
          type: "TAG_CLAIM" as const,
          code: claim.code || "—",
          createdAt: new Date(claim.createdAt || claim.claimDate),
          summary: `${claim.farmer.name} · 领用蟹扣 ${claim.claimCount.toLocaleString()} 只`,
          subSummary: `${claim.farmer.farmType === "LAKE_CRAB" ? "湖蟹" : "塘蟹"}养殖户 · 户号 ${claim.farmer.code}`,
          checkDescription: `领扣校验：在池存活 ${activeInPool.toLocaleString()} 只，年度剩余额度 ${remainingQuota.toLocaleString()} 只 (硬约束 ≤ min(在池, 余量) = ${maxClaimable.toLocaleString()} 只)${!isSafe ? " ⚠️ 超额领扣预警" : ""}`,
          applicantName: claim.applicant.fullName,
          applicantRole: claim.applicant.role === "WAREHOUSE_ADMIN" ? "库管员" : "业务员",
          tagClaimData: claim,
          outboundData: undefined,
        };
      })
    : [];

  const pendingOutboundCards = (typeFilter === "ALL" || typeFilter === "OUTBOUND")
    ? pendingOutboundOrders.map((order) => {
        const liveInBatch = order.batch ? order.batch.inPoolCount - order.batch.outPoolCount - order.batch.lossCount : 0;
        const typeLabel = order.type === "CRAB_CARD" ? "蟹卡提货 · 统一出库" : `${order.channel.name} · ${order.store.name}`;
        return {
          id: order.id,
          type: "OUTBOUND" as const,
          code: order.code,
          createdAt: new Date(order.createdAt),
          summary: `${typeLabel} · 出库 ${order.outboundCount.toLocaleString()} 只`,
          subSummary: `关联批次 ${order.batch.code} · ${order.batch.farmer.name} (${order.batch.gender === "MALE" ? "公" : "母"} ${order.batch.weightTier})`,
          checkDescription: `冷库与在池校验：出库 ${order.outboundCount.toLocaleString()} 只 / 批次在池存活 ${liveInBatch.toLocaleString()} 只 · 物流方式: ${order.logisticsNo || "门店自配"}`,
          applicantName: order.applicant.fullName,
          applicantRole: order.applicant.role === "WAREHOUSE_ADMIN" ? "库管员" : "业务员",
          tagClaimData: undefined,
          outboundData: order,
        };
      })
    : [];

  const pendingItems = [...pendingTagCards, ...pendingOutboundCards].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  return (
    <div className="flex flex-col gap-3.5">
      {/* 顶部标题与定位说明 */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">审批中心</h1>
          {totalPendingCount > 0 && (
            <Badge variant="destructive" className="font-mono text-[11px] px-1.5 py-0 animate-pulse">
              {totalPendingCount} 条待办
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          操作与审核分离：库管员发起的蟹扣领用与出库申请由内部核验员统一审核卡控
        </p>
      </div>

      {/* 统计概览卡片 */}
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Card className="transition-all hover:shadow-xs border-amber-500/20 bg-amber-500/[0.02]">
          <CardHeader className="p-2.5 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-amber-700 dark:text-amber-400">待审蟹扣领用</CardTitle>
            <Tag className="size-3.5 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-base font-bold font-mono text-amber-600 dark:text-amber-400">
              {pendingTagClaims.length.toLocaleString()} 笔
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">在池存活与额度余量双重核验</p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-xs border-cyan-500/20 bg-cyan-500/[0.02]">
          <CardHeader className="p-2.5 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-cyan-700 dark:text-cyan-400">待审出库申请</CardTitle>
            <Truck className="size-3.5 text-cyan-600 dark:text-cyan-400" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-base font-bold font-mono text-cyan-600 dark:text-cyan-400">
              {pendingOutboundOrders.length.toLocaleString()} 笔
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">冷库规格库存与批次存活校验</p>
          </CardContent>
        </Card>

        <Card className={`transition-all hover:shadow-xs ${exceptionBatches.length > 0 ? "border-destructive/40 bg-destructive/5" : "border-border/80"}`}>
          <CardHeader className="p-2.5 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium">损耗超标待查</CardTitle>
            <AlertTriangle className={`size-3.5 ${exceptionBatches.length > 0 ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className={`text-base font-bold font-mono ${exceptionBatches.length > 0 ? "text-destructive" : ""}`}>
              {exceptionBatches.length.toLocaleString()} 批
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">累计损耗率超 5% 标红预警</p>
          </CardContent>
        </Card>
      </div>

      {/* 主选项卡：待审核 / 已处理 / 损耗超标 */}
      <Tabs defaultValue={activeTab} className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b pb-2.5">
          <TabsList className="grid w-full grid-cols-3 max-w-[440px] h-8">
            <TabsTrigger value="pending" className="flex items-center gap-1.5 text-xs">
              <Clock className="size-3" />
              待审核 ({totalPendingCount})
            </TabsTrigger>
            <TabsTrigger value="processed" className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="size-3" />
              已处理 ({processedCount})
            </TabsTrigger>
            <TabsTrigger value="exceptions" className="flex items-center gap-1.5 text-xs">
              <AlertTriangle className="size-3 text-destructive" />
              损耗超标 ({exceptionBatches.length})
            </TabsTrigger>
          </TabsList>

          {activeTab === "pending" && (
            <div className="flex items-center gap-1 text-xs bg-muted/60 p-0.5 rounded-md self-start sm:self-auto">
              <Link
                href="/approvals?tab=pending&type=ALL"
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  typeFilter === "ALL"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                全部待办 ({totalPendingCount})
              </Link>
              <Link
                href="/approvals?tab=pending&type=TAG"
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  typeFilter === "TAG"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                蟹扣领用 ({pendingTagClaims.length})
              </Link>
              <Link
                href="/approvals?tab=pending&type=OUTBOUND"
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  typeFilter === "OUTBOUND"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                出库申请 ({pendingOutboundOrders.length})
              </Link>
            </div>
          )}
        </div>

        {/* 1. 待审核标签页 (紧凑型待办卡片流) */}
        <TabsContent value="pending" className="flex flex-col gap-2.5 mt-0">
          {pendingItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="size-10 text-emerald-500/60 mb-2" />
                <h3 className="text-sm font-semibold text-foreground">暂无待审批事项</h3>
                <p className="text-xs text-muted-foreground mt-0.5">所有领扣与出库申请均已完成核验与审核</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {pendingItems.map((item) => {
                const isTag = item.type === "TAG_CLAIM";
                return (
                  <Card
                    key={`${item.type}_${item.id}`}
                    className={cn(
                      "transition-all border-l-4 hover:shadow-xs",
                      isTag
                        ? "border-l-amber-500 bg-amber-500/[0.015]"
                        : "border-l-cyan-500 bg-cyan-500/[0.015]"
                    )}
                  >
                    <CardContent className="p-3 sm:p-3.5 flex flex-col gap-2">
                      {/* 卡片主信息行：左侧类型单号与摘要，右侧操作按钮与时间 */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isTag ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold px-1.5 py-0 text-[11px] flex items-center gap-1 h-5"
                            >
                              <Tag className="size-2.5" />
                              蟹扣领用
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 font-semibold px-1.5 py-0 text-[11px] flex items-center gap-1 h-5"
                            >
                              <Truck className="size-2.5" />
                              出库申请
                            </Badge>
                          )}
                          <span className="font-mono text-xs font-bold text-foreground">{item.code}</span>
                          <span className="text-xs font-semibold text-foreground">{item.summary}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            ({item.subSummary})
                          </span>
                        </div>

                        {/* 右侧：申请时间与审批操作 */}
                        <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                            <Clock className="size-3" />
                            <span>{formatDate(item.createdAt)} {formatTime(item.createdAt)}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isTag && item.tagClaimData && (
                              <TagApprovalButton claimId={item.tagClaimData.id} />
                            )}
                            {!isTag && item.outboundData && (
                              <OutboundApprovalButton orderId={item.outboundData.id} />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 底部信息条：校验口径 + 申请人 */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-1.5 border-t border-border/40 text-[11px]">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <ShieldCheck className="size-3.5 text-primary shrink-0" />
                          <span className="font-medium text-foreground shrink-0">校验口径:</span>
                          <span className="font-mono text-muted-foreground leading-snug">
                            {item.checkDescription}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-muted-foreground shrink-0 self-start sm:self-auto">
                          <UserCheck className="size-3 text-muted-foreground" />
                          <span>申请人: <strong className="text-foreground font-medium">{item.applicantName}</strong> ({item.applicantRole})</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 2. 已处理历史标签页 */}
        <TabsContent value="processed">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">已处理审批历史 (最新 100 笔)</CardTitle>
              <CardDescription className="text-xs">
                包含已一键通过放行及已填写原因驳回的蟹扣领用与出库申请留痕
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[110px]">类型</TableHead>
                      <TableHead className="w-[150px]">单号</TableHead>
                      <TableHead className="min-w-[200px]">审批摘要</TableHead>
                      <TableHead className="w-[110px]">申请人</TableHead>
                      <TableHead className="w-[100px]">状态</TableHead>
                      <TableHead className="w-[140px]">审核人 / 时间</TableHead>
                      <TableHead className="min-w-[180px]">审核意见 / 驳回原因</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedTagClaims.length === 0 && processedOutboundOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                          暂无已处理历史记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      [
                        ...processedTagClaims.map((c) => ({
                          id: c.id,
                          type: "TAG" as const,
                          code: c.code || "—",
                          summary: `${c.farmer.name} · 领用蟹扣 ${c.claimCount.toLocaleString()} 只`,
                          applicant: c.applicant.fullName,
                          status: c.status,
                          approver: c.approver?.fullName || "质量总监",
                          approvedAt: c.approvedAt || c.updatedAt,
                          comment: c.approvalComment || (c.status === "APPROVED" ? "审核通过" : "已驳回"),
                        })),
                        ...processedOutboundOrders.map((o) => ({
                          id: o.id,
                          type: "OUTBOUND" as const,
                          code: o.code,
                          summary: `${o.store.name} · 出库 ${o.outboundCount.toLocaleString()} 只 (${o.batch.farmer.name})`,
                          applicant: o.applicant.fullName,
                          status: o.status,
                          approver: o.approver?.fullName || "质量总监",
                          approvedAt: o.approvedAt || o.updatedAt,
                          comment: o.approvalComment || o.rejectReason || (o.status === "APPROVED" ? "审核通过" : "已驳回"),
                        })),
                      ]
                        .sort((a, b) => new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime())
                        .map((row) => (
                          <TableRow key={`${row.type}_${row.id}`} className="hover:bg-muted/30">
                            <TableCell className="align-middle">
                              {row.type === "TAG" ? (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">
                                  蟹扣领用
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 text-[10px] px-1.5 py-0">
                                  出库申请
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="align-middle font-mono font-semibold text-xs">
                              {row.code}
                            </TableCell>

                            <TableCell className="align-middle text-xs font-medium">
                              {row.summary}
                            </TableCell>

                            <TableCell className="align-middle text-xs text-muted-foreground">
                              {row.applicant}
                            </TableCell>

                            <TableCell className="align-middle">
                              {row.status === "APPROVED" ? (
                                <Badge variant="default" className="text-[10px] px-1.5 py-0 font-normal">
                                  已通过
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-normal">
                                  已驳回
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col text-[11px] font-mono text-muted-foreground">
                                <span className="text-foreground font-medium">{row.approver}</span>
                                <span>{formatDate(row.approvedAt)} {formatTime(row.approvedAt)}</span>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle text-xs">
                              <span className={cn(row.status === "REJECTED" ? "text-destructive font-medium" : "text-muted-foreground")}>
                                {row.comment}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. 损耗超标监控标签页 */}
        <TabsContent value="exceptions">
          <Card className="border-destructive/30">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="size-5" />
                损耗超标批次监控
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[180px]">批次与规格</TableHead>
                      <TableHead className="min-w-[180px]">养殖户与暂养池</TableHead>
                      <TableHead className="min-w-[240px]">损耗率与损耗数量</TableHead>
                      <TableHead className="min-w-[220px]">损耗原因</TableHead>
                      <TableHead className="w-[110px]">处置状态</TableHead>
                      <TableHead className="text-right w-[170px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptionBatches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          暂无损耗超标批次
                        </TableCell>
                      </TableRow>
                    ) : (
                      exceptionBatches.map((batch) => {
                        const lossRateNum =
                          batch.inPoolCount > 0
                            ? Number(((batch.lossCount / batch.inPoolCount) * 100).toFixed(2))
                            : 0;
                        const excessRate = (lossRateNum - 5.0).toFixed(2);
                        const isSevere = lossRateNum >= 7.0;
                        const liveInPool = batch.inPoolCount - batch.outPoolCount - batch.lossCount;
                        const lastLoss = batch.lossRecords[0];
                        const lastLossDate = lastLoss ? new Date(lastLoss.createdAt) : null;

                        return (
                          <TableRow key={batch.id} className="bg-destructive/[0.03] hover:bg-destructive/[0.08] transition-colors">
                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-1 items-start">
                                <BatchDetailDialog
                                  batch={batch}
                                  trigger={
                                    <button
                                      type="button"
                                      className="font-mono font-bold text-foreground hover:text-primary hover:underline cursor-pointer transition-colors text-left text-sm"
                                      title="点击查看批次完整档案"
                                    >
                                      {batch.code}
                                    </button>
                                  }
                                />
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted/40 font-normal">
                                    {batch.gender === "MALE" ? "公蟹" : "母蟹"}
                                  </Badge>
                                  <span className="text-[11px] font-mono text-muted-foreground">{batch.weightTier}</span>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 font-medium">
                                  <span className="text-sm font-semibold">{batch.farmer.name}</span>
                                  <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 border-primary/40 text-primary bg-primary/5">
                                    {batch.pool.code}
                                  </Badge>
                                </div>
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  {batch.farmer.code} · {batch.pool.name}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-1.5 py-0.5">
                                <div className="flex items-baseline justify-between gap-2">
                                  <div className="flex items-baseline gap-1">
                                    <span className={cn("font-mono font-bold text-base", isSevere ? "text-destructive" : "text-amber-600 dark:text-amber-400")}>
                                      {lossRateNum}%
                                    </span>
                                    <span className="text-xs font-medium text-destructive">
                                      (超标 +{excessRate}%)
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-mono text-muted-foreground">
                                    累计损耗 <strong className="text-destructive">{batch.lossCount}</strong> 只
                                  </span>
                                </div>

                                <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full transition-all", isSevere ? "bg-destructive" : "bg-amber-500")}
                                    style={{ width: `${Math.min(100, Math.max(8, lossRateNum * 7))}%` }}
                                  />
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>在池剩余敞口: <strong className="font-mono text-foreground font-semibold">{liveInPool.toLocaleString()}</strong> 只</span>
                                  <span className="text-[10px] text-muted-foreground">基准线: 5.0%</span>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-1 max-w-[220px]">
                                <span
                                  className="text-xs font-medium text-foreground line-clamp-2"
                                  title={lastLoss?.reason || batch.exceptionReason || "损耗超标"}
                                >
                                  {lastLoss?.reason || batch.exceptionReason || "损耗超标"}
                                </span>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                                  <span>{lastLoss?.inspector?.fullName || "仓库管理员"}</span>
                                  {lastLossDate && (
                                    <>
                                      <span>·</span>
                                      <span>
                                        {formatDateTime(lastLoss.createdAt)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              {batch.status === "FROZEN" ? (
                                <Badge variant="destructive" className="font-normal text-xs py-0.5">
                                  <span className="size-1.5 rounded-full bg-white animate-pulse mr-1 inline-block" />
                                  已冻结
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="font-normal text-xs py-0.5 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5 inline-block" />
                                  待核实
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="text-right align-middle">
                              <div className="flex items-center justify-end gap-1.5">
                                <BatchLossHistoryDialog batch={batch} />
                                <BatchFreezeButton
                                  batchId={batch.id}
                                  batchCode={batch.code}
                                  isFrozen={batch.status === "FROZEN"}
                                  userId={currentUser.id}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
