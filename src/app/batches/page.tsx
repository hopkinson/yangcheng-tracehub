import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MultiSpecIntakeDialog } from "@/components/batches/MultiSpecIntakeDialog";
import { BatchDetailDialog } from "@/components/batches/BatchDetailDialog";
import { BatchRowActions } from "@/components/batches/BatchRowActions";
import { BatchInspectionDialog } from "@/components/batches/BatchInspectionDialog";
import { BatchReportViewDialog } from "@/components/batches/BatchReportViewDialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { StaggerContainer, FadeIn } from "@/components/motion/MotionWrapper";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, FileText, FileCheck, ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";

function InspectionTag({
  status,
  url,
  label,
  batchCode,
  reportName,
}: {
  status?: string | null;
  url?: string | null;
  label: string;
  batchCode: string;
  reportName?: string | null;
}) {
  if (status === "QUALIFIED") {
    const text = `${label}合格`;
    if (url) {
      return (
        <BatchReportViewDialog
          batchCode={batchCode}
          reportName={reportName || text}
          reportUrl={url}
          title={`${label}报告 (${batchCode})`}
          trigger={
            <button
              type="button"
              className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline text-left cursor-pointer group"
              title="查看报告原件"
            >
              <CheckCircle2 className="size-3 shrink-0" />
              <span>{text}</span>
              <FileCheck className="size-2.5 opacity-60 group-hover:opacity-100" />
            </button>
          }
        />
      );
    }
    return (
      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3 shrink-0" /> {text}
      </span>
    );
  }
  if (status === "UNQUALIFIED") {
    return (
      <span className="flex items-center gap-1 text-destructive font-medium">
        <XCircle className="size-3 shrink-0" /> {label}不合格
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500 font-medium">
      <Clock className="size-3 shrink-0" /> {label}待检
    </span>
  );
}

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
        items: { include: { pool: true } },
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
      include: {
        batches: { where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
        batchItems: { where: { batch: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } } },
      },
    }),
  ]);

  const currentUserId = currentUser?.id || "";
  const isAdmin = currentUser?.role === "ADMIN";
  const isQaOrAdmin = currentUser?.role === "QA_DIRECTOR" || isAdmin;
  const isWarehouseOrAdmin = currentUser?.role === "WAREHOUSE_ADMIN" || isAdmin;

  // 格式化养殖户剩余额度
  const farmerOptions = farmers.map((f: any) => {
    const cumulative = f.batches.reduce((sum: number, b: any) => sum + b.inPoolCount, 0);
    return {
      id: f.id,
      name: f.name,
      code: f.code,
      quota: f.quota,
      remainingQuota: Math.max(0, f.quota - cumulative),
      status: f.status,
      enclosures: f.enclosures.map((e: any) => ({ id: e.id, code: e.code, description: e.description })),
    };
  });

  const poolOptions = pools.map((p: any) => {
    const directLive = p.batches?.reduce((sum: number, b: any) => sum + Math.max(0, b.inPoolCount - b.outPoolCount - b.lossCount), 0) || 0;
    const itemLive = p.batchItems?.reduce(
      (acc: number, cur: any) => acc + Math.max(0, cur.inPoolCount - cur.outPoolCount - cur.lossCount),
      0
    ) || 0;
    const liveCount = Math.max(directLive, itemLive);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      currentGender: p.currentGender,
      currentWeightTier: p.currentWeightTier,
      liveCount,
    };
  });

  return (
    <StaggerContainer className="flex flex-col gap-6">
      <FadeIn direction="down" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">原料批次</h1>
        {isWarehouseOrAdmin && (
          <div className="flex items-center gap-2">
            <MultiSpecIntakeDialog farmers={farmerOptions} pools={poolOptions} userId={currentUserId} />
          </div>
        )}
      </FadeIn>

      <FadeIn>
        <Card>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[180px]">批次号 / 码单表号</TableHead>
                    <TableHead className="min-w-[180px]">来源养殖户</TableHead>
                    <TableHead className="min-w-[240px]">入库码单多规格明细</TableHead>
                    <TableHead className="min-w-[180px]">在池存活与流转</TableHead>
                    <TableHead className="w-[130px]">品控快检 / 抽检</TableHead>
                    <TableHead className="w-[110px]">批次状态</TableHead>
                    <TableHead className="text-right w-[160px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch: any) => {
                    const liveInPool = Math.max(0, batch.inPoolCount - batch.outPoolCount - batch.lossCount);
                    const livePct = batch.inPoolCount > 0 ? Math.min(100, Math.round((liveInPool / batch.inPoolCount) * 100)) : 0;
                    const hasMultiItems = batch.items && batch.items.length > 0;
                    const isPendingQc = batch.quickCheck !== "QUALIFIED" || batch.sampleCheck !== "QUALIFIED";

                    return (
                      <TableRow key={batch.id} className="hover:bg-muted/30 transition-colors">
                        {/* 1. 批次与码单 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-0.5 items-start">
                            <BatchDetailDialog
                              batch={batch}
                              trigger={
                                <button
                                  type="button"
                                  className="font-mono font-bold text-foreground text-sm hover:text-primary hover:underline transition-colors text-left cursor-pointer inline-flex items-center gap-1 group"
                                  title="点击查阅电子入库码单与品控原件"
                                >
                                  <span>{batch.code}</span>
                                  <FileText className="size-3 text-muted-foreground group-hover:text-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                                </button>
                              }
                            />
                            {batch.formNo && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {batch.formNo}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 2. 来源养殖户 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold">{batch.farmer.name}</span>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {batch.farmer.code} {batch.enclosure && `· ${batch.enclosure.code}`}
                            </span>
                          </div>
                        </TableCell>

                        {/* 3. 码单多规格明细 Chips */}
                        <TableCell className="align-middle">
                          {hasMultiItems ? (
                            <div className="flex flex-wrap gap-1 max-w-[260px]">
                              {batch.items.map((it: any) => (
                                <span
                                  key={it.id}
                                  className="px-1.5 py-0.5 rounded bg-muted/80 text-[10px] font-mono border"
                                >
                                  {it.pool.code} ({it.gender === "FEMALE" ? "母" : "公"}{it.weightTier}) · {it.inPoolCount}只
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 font-mono text-xs">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                {batch.pool?.code || "ZY-01"}
                              </Badge>
                              <span>{batch.gender === "FEMALE" ? "母蟹" : "公蟹"} {batch.weightTier}</span>
                              <span className="text-muted-foreground">({batch.inPoolCount}只)</span>
                            </div>
                          )}
                        </TableCell>

                        {/* 4. 在池存活与流转 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-1.5 py-0.5">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                                {liveInPool.toLocaleString()} 只
                              </span>
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
                          </div>
                        </TableCell>

                        {/* 5. 品控快检/抽检 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-1 text-[11px]">
                            <InspectionTag
                              status={batch.quickCheck}
                              url={batch.quickCheckUrl || batch.reportUrl}
                              label="农残快检"
                              batchCode={batch.code}
                              reportName={batch.quickCheckName || batch.reportName}
                            />
                            <InspectionTag
                              status={batch.sampleCheck}
                              url={batch.sampleCheckUrl}
                              label="试吃抽检"
                              batchCode={batch.code}
                              reportName={batch.sampleCheckName}
                            />

                            {(isQaOrAdmin || isWarehouseOrAdmin) && (
                              <BatchInspectionDialog
                                batch={batch}
                                userId={currentUserId}
                                trigger={
                                  <button
                                    type="button"
                                    className={cn(
                                      "text-[10px] text-left cursor-pointer transition-colors pt-0.5",
                                      isPendingQc
                                        ? "inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded mt-0.5 w-fit"
                                        : "text-muted-foreground hover:text-primary hover:underline"
                                    )}
                                  >
                                    {isPendingQc && <ClipboardCheck className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />}
                                    <span>{isPendingQc ? "录入检测报告" : "✎ 完善检测报告"}</span>
                                  </button>
                                }
                              />
                            )}
                          </div>
                        </TableCell>

                        {/* 6. 批次状态 */}
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
                              {batch.status === "PARTIALLY_OUTBOUND" ? "部分出库" : "已出清"}
                            </Badge>
                          )}
                        </TableCell>

                        {/* 7. 操作 */}
                        <TableCell className="text-right align-middle">
                          <BatchRowActions
                            batch={batch}
                            userId={currentUserId}
                            isWarehouseOrAdmin={isWarehouseOrAdmin}
                            isQaOrAdmin={isQaOrAdmin}
                          />
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
