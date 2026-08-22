import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagApprovalButton, OutboundApprovalButton } from "@/components/forms/ApprovalActions";
import { BatchFreezeButton } from "@/components/batches/BatchFreezeButton";
import { BatchDetailDialog } from "@/components/batches/BatchDetailDialog";
import { BatchLossHistoryDialog } from "@/components/batches/BatchLossHistoryDialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Tag, Truck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    tagsPage?: string;
    tagsPageSize?: string;
    tagsFilter?: string;
    outboundPage?: string;
    outboundPageSize?: string;
    outboundFilter?: string;
  }>;
}) {
  const [currentUser, params] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ]);
  const defaultTab = params.tab || "tags";
  const tagsPage = Math.max(1, Number(params.tagsPage) || 1);
  const tagsPageSize = Math.max(1, Number(params.tagsPageSize) || 10);
  const outboundPage = Math.max(1, Number(params.outboundPage) || 1);
  const outboundPageSize = Math.max(1, Number(params.outboundPageSize) || 10);

  const tagsFilter = params.tagsFilter === "ALL" ? "ALL" : "PENDING";
  const outboundFilter = params.outboundFilter === "ALL" ? "ALL" : "PENDING";

  const tagsWhere = tagsFilter === "PENDING" ? { status: "PENDING" } : undefined;
  const outboundWhere = outboundFilter === "PENDING" ? { status: "PENDING" } : undefined;

  const [
    pendingTagClaimsCount,
    totalTagClaims,
    filteredTagClaimsCount,
    tagClaims,
    pendingOutboundCount,
    totalOutboundOrders,
    filteredOutboundCount,
    outboundOrders,
    exceptionBatchesCount,
    exceptionBatches,
  ] = await Promise.all([
    prisma.tagClaim.count({ where: { status: "PENDING" } }),
    prisma.tagClaim.count(),
    prisma.tagClaim.count({ where: tagsWhere }),
    prisma.tagClaim.findMany({
      where: tagsWhere,
      skip: (tagsPage - 1) * tagsPageSize,
      take: tagsPageSize,
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
    prisma.outboundOrder.count({ where: { status: "PENDING" } }),
    prisma.outboundOrder.count(),
    prisma.outboundOrder.count({ where: outboundWhere }),
    prisma.outboundOrder.findMany({
      where: outboundWhere,
      skip: (outboundPage - 1) * outboundPageSize,
      take: outboundPageSize,
      include: {
        batch: { include: { farmer: true, pool: true } },
        store: { include: { channel: true } },
        channel: true,
        applicant: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.batch.count({
      where: {
        isException: true,
        status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND", "FROZEN"] },
      },
    }),
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">审批中心</h1>
          <p className="text-xs text-muted-foreground">蟹扣领用申请与出库发货审批</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="transition-all hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">待审蟹扣领用</CardTitle>
            <Tag className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {pendingTagClaimsCount.toLocaleString()} 笔
            </div>
            <p className="text-xs text-muted-foreground mt-1">核对在池存活与剩余额度</p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">待审出库单</CardTitle>
            <Truck className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {pendingOutboundCount.toLocaleString()} 笔
            </div>
            <p className="text-xs text-muted-foreground mt-1">核对批次在池存活</p>
          </CardContent>
        </Card>

        <Card className={`transition-all hover:shadow-xs ${exceptionBatchesCount > 0 ? "border-destructive/40 bg-destructive/5" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">损耗超标待查</CardTitle>
            <AlertTriangle className={`size-4 ${exceptionBatchesCount > 0 ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${exceptionBatchesCount > 0 ? "text-destructive" : ""}`}>
              {exceptionBatchesCount.toLocaleString()} 批
            </div>
            <p className="text-xs text-muted-foreground mt-1">累计损耗率超 5%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={defaultTab} className="flex flex-col gap-4">
        <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
          <TabsTrigger value="tags" className="flex items-center gap-2 text-xs">
            <Tag className="size-3.5" />
            蟹扣领用 ({pendingTagClaimsCount})
          </TabsTrigger>
          <TabsTrigger value="outbound" className="flex items-center gap-2 text-xs">
            <Truck className="size-3.5" />
            出库审批 ({pendingOutboundCount})
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="flex items-center gap-2 text-xs">
            <AlertTriangle className="size-3.5 text-destructive" />
            损耗超标 ({exceptionBatchesCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tags">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>蟹扣领用审批列表</CardTitle>
              <div className="flex items-center gap-1.5 text-xs bg-muted/60 p-1 rounded-md">
                <Link
                  href={`/approvals?tab=tags&tagsFilter=PENDING&outboundFilter=${outboundFilter}&tagsPage=1`}
                  className={`px-2 py-1 rounded font-medium transition-colors ${
                    tagsFilter === "PENDING"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  待审批 ({pendingTagClaimsCount})
                </Link>
                <Link
                  href={`/approvals?tab=tags&tagsFilter=ALL&outboundFilter=${outboundFilter}&tagsPage=1`}
                  className={`px-2 py-1 rounded font-medium transition-colors ${
                    tagsFilter === "ALL"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  全部历史 ({totalTagClaims})
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[120px]">申请时间</TableHead>
                      <TableHead className="min-w-[200px]">养殖户</TableHead>
                      <TableHead className="min-w-[260px]">领扣数量与存活/额度</TableHead>
                      <TableHead className="w-[130px]">申请人</TableHead>
                      <TableHead className="w-[100px]">状态</TableHead>
                      <TableHead className="text-right w-[160px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tagClaims.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          {tagsFilter === "PENDING" ? "暂无待审批的蟹扣领用申请" : "暂无蟹扣领用记录"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      tagClaims.map((claim) => {
                        const activeInPool = claim.farmer.batches.reduce(
                          (sum, b) => sum + (b.inPoolCount - b.outPoolCount - b.lossCount),
                          0
                        );
                        const cumulativeClaimed = claim.farmer.tagClaims.reduce((sum, c) => sum + c.boundCount, 0);
                        const remainingQuota = Math.max(0, claim.farmer.quota - cumulativeClaimed);
                        const maxClaimable = Math.min(activeInPool, remainingQuota);
                        const isSafe = claim.claimCount <= maxClaimable && claim.claimCount > 0;
                        const usageRatio = activeInPool > 0 ? Math.min(100, Math.round((claim.claimCount / activeInPool) * 100)) : 0;
                        const dateObj = new Date(claim.createdAt || claim.claimDate);

                        return (
                          <TableRow key={claim.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="align-middle">
                              <div className="flex flex-col">
                                <span className="font-mono text-xs font-semibold text-foreground">
                                  {dateObj.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}
                                </span>
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {dateObj.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-sm text-foreground">{claim.farmer.name}</span>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted/60 font-normal">
                                    {claim.farmer.farmType === "LAKE_CRAB" ? "湖蟹" : "塘蟹"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                                  <span className="bg-muted px-1 rounded text-[10px]">{claim.farmer.code}</span>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-1.5 py-0.5">
                                <div className="flex items-baseline justify-between gap-2">
                                  <div className="flex items-baseline gap-1">
                                    <span className="font-mono font-bold text-base text-primary">
                                      {claim.claimCount.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-normal">只</span>
                                  </div>
                                  <span className="text-[11px] font-mono text-muted-foreground">
                                    占在池 <strong className={cn(usageRatio > 80 ? "text-amber-500 font-bold" : "text-foreground")}>{usageRatio}%</strong>
                                  </span>
                                </div>

                                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all",
                                      !isSafe ? "bg-destructive" : usageRatio > 80 ? "bg-amber-500" : "bg-emerald-500"
                                    )}
                                    style={{ width: `${Math.max(4, Math.min(100, usageRatio))}%` }}
                                  />
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>在池: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{activeInPool.toLocaleString()}</strong> 只</span>
                                  <span>额度余量: <strong className="font-mono font-semibold">{remainingQuota.toLocaleString()}</strong> 只</span>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-xs text-foreground">{claim.applicant.fullName}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {claim.applicant.role === "WAREHOUSE_ADMIN" ? "仓库主管" : claim.applicant.role === "ADMIN" ? "管理员" : "业务员"}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <Badge
                                variant={
                                  claim.status === "APPROVED"
                                    ? "default"
                                    : claim.status === "REJECTED"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className={cn(
                                  "font-normal text-xs py-0.5",
                                  claim.status === "PENDING" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                )}
                              >
                                {claim.status === "PENDING" && (
                                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5 inline-block" />
                                )}
                                {claim.status === "APPROVED"
                                  ? "已通过"
                                  : claim.status === "REJECTED"
                                  ? "已驳回"
                                  : "待审批"}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-right align-middle">
                              {claim.status === "PENDING" ? (
                                <TagApprovalButton claimId={claim.id} />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {claim.approvalComment || "已处理"}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <DataTablePagination
                total={filteredTagClaimsCount}
                page={tagsPage}
                pageSize={tagsPageSize}
                pageParam="tagsPage"
                pageSizeParam="tagsPageSize"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outbound">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>出库发货审批列表</CardTitle>
              <div className="flex items-center gap-1.5 text-xs bg-muted/60 p-1 rounded-md">
                <Link
                  href={`/approvals?tab=outbound&outboundFilter=PENDING&tagsFilter=${tagsFilter}&outboundPage=1`}
                  className={`px-2 py-1 rounded font-medium transition-colors ${
                    outboundFilter === "PENDING"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  待审批 ({pendingOutboundCount})
                </Link>
                <Link
                  href={`/approvals?tab=outbound&outboundFilter=ALL&tagsFilter=${tagsFilter}&outboundPage=1`}
                  className={`px-2 py-1 rounded font-medium transition-colors ${
                    outboundFilter === "ALL"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  全部历史 ({totalOutboundOrders})
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[140px]">出库单号</TableHead>
                      <TableHead className="min-w-[180px]">批次与养殖来源</TableHead>
                      <TableHead className="min-w-[240px]">出库数量与可用存活</TableHead>
                      <TableHead className="min-w-[160px]">目标门店 / 渠道</TableHead>
                      <TableHead className="w-[110px]">申请人</TableHead>
                      <TableHead className="w-[100px]">状态</TableHead>
                      <TableHead className="text-right w-[160px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outboundOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                          {outboundFilter === "PENDING" ? "暂无待审批的出库发运单" : "暂无出库单记录"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      outboundOrders.map((order) => {
                        const liveInBatch =
                          order.batch.inPoolCount - order.batch.outPoolCount - order.batch.lossCount;
                        const usageRatio = liveInBatch > 0 ? Math.min(100, Math.round((order.outboundCount / liveInBatch) * 100)) : 0;
                        const isSafe = order.outboundCount <= liveInBatch;

                        return (
                          <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="align-middle">
                              <span className="font-mono font-semibold text-xs text-foreground">{order.code}</span>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs font-semibold">{order.batch.code}</span>
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-3.5 font-normal">
                                    {order.batch.gender === "MALE" ? "公" : "母"} {order.batch.weightTier}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">{order.batch.farmer.name}</span>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-1.5 py-0.5">
                                <div className="flex items-baseline justify-between gap-2">
                                  <div className="flex items-baseline gap-1">
                                    <span className="font-mono font-bold text-base text-primary">
                                      {order.outboundCount.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-normal">只</span>
                                  </div>
                                  <span className="text-[11px] font-mono text-muted-foreground">
                                    占批次在池 {usageRatio}%
                                  </span>
                                </div>

                                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all",
                                      !isSafe ? "bg-destructive" : usageRatio > 80 ? "bg-amber-500" : "bg-emerald-500"
                                    )}
                                    style={{ width: `${Math.max(4, Math.min(100, usageRatio))}%` }}
                                  />
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>批次可用存活: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{liveInBatch.toLocaleString()}</strong> 只</span>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-medium">{order.store.name}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">{order.channel.name}</span>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-xs">{order.applicant.fullName}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {order.applicant.role === "WAREHOUSE_ADMIN" ? "仓库管理员" : order.applicant.role === "ADMIN" ? "管理员" : "业务员"}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-1 items-start">
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
                                    order.status === "PENDING" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                  )}
                                >
                                  {order.status === "PENDING" && (
                                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5 inline-block" />
                                  )}
                                  {order.status === "APPROVED"
                                    ? "已通过"
                                    : order.status === "REJECTED"
                                    ? "已驳回"
                                    : "待审批"}
                                </Badge>
                                {order.status === "PENDING" && order.rejectReason && (
                                  <span
                                    className="text-[10px] font-medium text-amber-600 dark:text-amber-400 max-w-[130px] truncate"
                                    title={`曾驳回原因: ${order.rejectReason}`}
                                  >
                                    曾驳回: {order.rejectReason}
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-right align-middle">
                              {order.status === "PENDING" ? (
                                <OutboundApprovalButton orderId={order.id} />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {order.approvalComment || order.rejectReason || "已处理"}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <DataTablePagination
                total={filteredOutboundCount}
                page={outboundPage}
                pageSize={outboundPageSize}
                pageParam="outboundPage"
                pageSizeParam="outboundPageSize"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exceptions">
          <Card className="border-destructive/30">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="size-5" />
                损耗超标批次
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
                            {/* 1. 异常批次与规格 */}
                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-1 items-start">
                                <BatchDetailDialog
                                  batch={batch}
                                  userId={currentUser.id}
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

                            {/* 2. 来源养殖户与暂养池 */}
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

                            {/* 3. 损耗超标水位与风险敞口 */}
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

                            {/* 4. 损耗原因与盘点责任 */}
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
                                        {lastLossDate.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}{" "}
                                        {lastLossDate.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* 5. 处置状态 */}
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

                            {/* 6. 品控处置操作 */}
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
