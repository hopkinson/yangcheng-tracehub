import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BatchIntakeDialog } from "@/components/forms/BatchIntakeDialog";
import { LossRegisterDialog } from "@/components/forms/LossRegisterDialog";
import { BatchReportViewDialog } from "@/components/batches/BatchReportViewDialog";
import { BatchReportUploadDialog } from "@/components/batches/BatchReportUploadDialog";
import { BatchFreezeButton } from "@/components/batches/BatchFreezeButton";
import { BatchLossHistoryDialog } from "@/components/batches/BatchLossHistoryDialog";
import { BatchDetailDialog } from "@/components/batches/BatchDetailDialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { StaggerContainer, FadeIn, PulseBadge } from "@/components/motion/MotionWrapper";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 10);

  const [currentUser, totalBatches, batches, farmers, pools] = await Promise.all([
    getCurrentUser(),
    prisma.batch.count(),
    prisma.batch.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        farmer: true,
        enclosure: true,
        pool: true,
        lossRecords: {
          include: { inspector: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.farmer.findMany({
      include: { enclosures: true, batches: true },
      where: { status: "ACTIVE" },
    }),
    prisma.holdingPool.findMany({
      where: { status: "ACTIVE" },
    }),
  ]);

  const currentUserId = currentUser?.id || "";
  const isAdmin = currentUser?.role === "ADMIN";
  const isQaOrAdmin = currentUser?.role === "QA_DIRECTOR" || isAdmin;
  const isWarehouseOrAdmin = currentUser?.role === "WAREHOUSE_ADMIN" || isAdmin;

  return (
    <StaggerContainer className="flex flex-col gap-6">
      <FadeIn direction="down" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">原料批次</h1>
          <p className="text-xs text-muted-foreground">活蟹批次入池登记与在池存活跟踪</p>
        </div>
        {isWarehouseOrAdmin && (
          <BatchIntakeDialog farmers={farmers} pools={pools} userId={currentUserId} isAdmin={isAdmin} />
        )}
      </FadeIn>

      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle>全量原料批次明细与在池存活状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[180px]">批次编号与规格</TableHead>
                    <TableHead className="min-w-[180px]">来源养殖户与暂养池</TableHead>
                    <TableHead className="min-w-[220px]">在池存活与流转水位</TableHead>
                    <TableHead className="w-[140px]">累计损耗</TableHead>
                    <TableHead className="w-[120px]">检测报告</TableHead>
                    <TableHead className="w-[110px]">批次状态</TableHead>
                    <TableHead className="text-right w-[150px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const liveInPool = batch.inPoolCount - batch.outPoolCount - batch.lossCount;
                    const livePct = batch.inPoolCount > 0 ? Math.min(100, Math.round((liveInPool / batch.inPoolCount) * 100)) : 0;

                    return (
                      <TableRow key={batch.id} className="hover:bg-muted/30 transition-colors">
                        {/* 1. 批次与规格 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-1 items-start">
                            <BatchDetailDialog
                              batch={batch}
                              userId={currentUserId}
                              isWarehouseOrAdmin={isWarehouseOrAdmin}
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

                        {/* 2. 来源与仓位 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 font-medium">
                              <span className="text-sm font-semibold">{batch.farmer.name}</span>
                              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 border-primary/40 text-primary bg-primary/5">
                                {batch.pool.code}
                              </Badge>
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {batch.farmer.code} · {batch.enclosure.code}
                            </span>
                          </div>
                        </TableCell>

                        {/* 3. 在池存活与流转 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-1.5 py-0.5">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                                  {liveInPool.toLocaleString()}
                                </span>
                                <span className="text-xs text-muted-foreground font-normal">只存活</span>
                              </div>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                存活率 {livePct}%
                              </span>
                            </div>

                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  livePct > 30 ? "bg-emerald-500" : livePct > 10 ? "bg-amber-500" : "bg-destructive"
                                )}
                                style={{ width: `${Math.max(4, Math.min(100, livePct))}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                              <span>初始: {batch.inPoolCount.toLocaleString()}</span>
                              <span>已出库: {batch.outPoolCount.toLocaleString()}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 4. 累计损耗 */}
                        <TableCell className="align-middle">
                          <BatchLossHistoryDialog batch={batch} />
                        </TableCell>

                        {/* 5. 检测报告 (独立列) */}
                        <TableCell className="align-middle">
                          <div className="flex items-center gap-1.5">
                            {batch.reportUrl ? (
                              <BatchReportViewDialog
                                batchCode={batch.code}
                                reportName={batch.reportName || "检测报告"}
                                reportUrl={batch.reportUrl}
                              />
                            ) : isWarehouseOrAdmin ? (
                              <BatchReportUploadDialog
                                batchId={batch.id}
                                batchCode={batch.code}
                                currentReportName={batch.reportName}
                                userId={currentUserId}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground italic">未上传</span>
                            )}
                          </div>
                        </TableCell>

                        {/* 6. 批次状态 (独立列) */}
                        <TableCell className="align-middle">
                          {batch.status === "FROZEN" ? (
                            <Badge variant="destructive" className="font-normal text-xs py-0.5">
                              <span className="size-1.5 rounded-full bg-white animate-pulse mr-1 inline-block" />
                              异常冻结
                            </Badge>
                          ) : batch.status === "TEMPORARY_HOLDING" ? (
                            <Badge variant="outline" className="font-normal text-xs py-0.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                              <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
                              暂养中
                            </Badge>
                          ) : (
                            <Badge variant={batch.status === "COMPLETED" ? "outline" : "secondary"} className="font-normal text-xs py-0.5">
                              {batch.status === "PARTIALLY_OUTBOUND" ? "部分出库" : "已完成"}
                            </Badge>
                          )}
                        </TableCell>

                        {/* 7. 操作 */}
                        <TableCell className="text-right align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            {batch.status !== "COMPLETED" && isWarehouseOrAdmin && (
                              <LossRegisterDialog batch={batch} userId={currentUserId} />
                            )}
                            {batch.status !== "COMPLETED" && isQaOrAdmin && (
                              <BatchFreezeButton
                                batchId={batch.id}
                                batchCode={batch.code}
                                isFrozen={batch.status === "FROZEN"}
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
            <DataTablePagination total={totalBatches} page={page} pageSize={pageSize} />
          </CardContent>
        </Card>
      </FadeIn>
    </StaggerContainer>
  );
}
