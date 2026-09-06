import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSpecIntakeDialog } from "@/components/batches/MultiSpecIntakeDialog";
import { BatchDetailDialog } from "@/components/batches/BatchDetailDialog";
import { BatchRowActions } from "@/components/batches/BatchRowActions";
import { BatchInspectionDialog } from "@/components/batches/BatchInspectionDialog";
import { BatchReportViewDialog } from "@/components/batches/BatchReportViewDialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { StaggerContainer, FadeIn } from "@/components/motion/MotionWrapper";
import { cn } from "@/lib/utils";
import { Invariants } from "@/lib/invariants";
import { CheckCircle2, XCircle, Clock, FileText, ClipboardCheck } from "lucide-react";

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
  const isQualified = status === "QUALIFIED";
  const isUnqualified = status === "UNQUALIFIED";

  if (isQualified) {
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
              className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer group whitespace-nowrap"
              title="查看报告原件"
            >
              <CheckCircle2 className="size-2.5 shrink-0" />
              <span>{text}</span>
            </button>
          }
        />
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="size-2.5 shrink-0" /> {text}
      </span>
    );
  }
  if (isUnqualified) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive font-medium whitespace-nowrap">
        <XCircle className="size-2.5 shrink-0" /> {label}不合格
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-500 font-medium whitespace-nowrap">
      <Clock className="size-2.5 shrink-0" /> {label}待检
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

  const poolOptions = pools.map((p: any) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    currentGender: p.currentGender,
    currentWeightTier: p.currentWeightTier,
    liveCount: Invariants.calculatePoolLiveCount(p),
  }));

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
          <CardContent className="p-4">
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[140px] min-w-[130px]">批次号 / 码单表号</TableHead>
                    <TableHead className="w-[130px] min-w-[120px]">来源养殖户</TableHead>
                    <TableHead className="w-[240px] min-w-[230px]">入库规格明细</TableHead>
                    <TableHead className="w-[120px] min-w-[110px]">在池存活</TableHead>
                    <TableHead className="w-[130px] min-w-[120px]">品控快检 / 抽检</TableHead>
                    <TableHead className="w-[85px] min-w-[70px]">状态</TableHead>
                    <TableHead className="text-right w-[100px] min-w-[90px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch: any) => {
                    const liveInPool = Math.max(0, batch.inPoolCount - batch.outPoolCount - batch.lossCount);
                    const livePct = batch.inPoolCount > 0 ? Math.min(100, Math.round((liveInPool / batch.inPoolCount) * 100)) : 0;
                    const hasMultiItems = batch.items && batch.items.length > 0;
                    const isPendingQc = batch.quickCheck !== "QUALIFIED" || batch.sampleCheck !== "QUALIFIED";
                    const firstItem = hasMultiItems ? batch.items[0] : batch;
                    const primaryPoolCode = (hasMultiItems ? batch.items[0].pool?.code : batch.pool?.code) || "ZY-01";

                    return (
                      <TableRow key={batch.id} className="hover:bg-muted/30 transition-colors">
                        {/* 1. 批次与码单 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-0.5 items-start max-w-[130px]">
                            <BatchDetailDialog
                              batch={batch}
                              trigger={
                                <button
                                  type="button"
                                  className="font-mono font-bold text-foreground text-xs hover:text-primary hover:underline transition-colors text-left cursor-pointer inline-flex items-center gap-1 group w-full"
                                  title={`点击查阅电子码单 (${batch.code})`}
                                >
                                  <span className="truncate">{batch.code}</span>
                                  <FileText className="size-3 text-muted-foreground group-hover:text-primary shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                                </button>
                              }
                            />
                            {batch.formNo && (
                              <span
                                className="text-[10px] font-mono text-muted-foreground truncate w-full"
                                title={batch.formNo}
                              >
                                {batch.formNo}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 2. 来源养殖户 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-0.5 max-w-[125px]">
                            <span className="text-xs font-semibold truncate" title={batch.farmer.name}>
                              {batch.farmer.name}
                            </span>
                            <span
                              className="text-[10px] font-mono text-muted-foreground truncate"
                              title={`${batch.farmer.code}${batch.enclosure ? ` · ${batch.enclosure.code}` : ""}`}
                            >
                              {batch.farmer.code} {batch.enclosure && `· ${batch.enclosure.code}`}
                            </span>
                          </div>
                        </TableCell>

                        {/* 3. 码单多规格明细 (Tag全称 + 规格 + 数量 三层结构化换行) */}
                        <TableCell className="align-middle min-w-[230px]">
                          <div className="flex flex-col gap-0.5 py-0.5">
                            {/* 第一行: Tag 完整全称 */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 font-mono font-normal text-muted-foreground break-all"
                                title={primaryPoolCode}
                              >
                                {primaryPoolCode}
                              </Badge>
                              {hasMultiItems && batch.items.length > 1 && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-sans font-medium transition-colors cursor-pointer shrink-0"
                                    >
                                      +{batch.items.length - 1} 规格
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-68 p-2.5 text-xs shadow-md" align="start">
                                    <div className="font-sans font-semibold mb-1.5 pb-1 border-b text-foreground text-[11px] flex justify-between">
                                      <span>入库多规格清单</span>
                                      <span className="text-muted-foreground font-normal">共 {batch.items.length} 档</span>
                                    </div>
                                    <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                                      {batch.items.map((it: any) => (
                                        <div key={it.id} className="flex flex-col gap-0.5 py-1 border-b last:border-0 border-border/40 text-[11px]">
                                          <span className="text-[10px] font-mono text-muted-foreground break-all">
                                            {it.pool?.code || "ZY-01"}
                                          </span>
                                          <div className="flex items-center justify-between font-mono">
                                            <span className="font-medium text-foreground">
                                              {it.gender === "FEMALE" ? "母蟹" : "公蟹"} {it.weightTier}
                                            </span>
                                            <span className="font-semibold text-foreground">
                                              {it.inPoolCount.toLocaleString()} 只
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>

                            {/* 第二行: 规格 */}
                            <div className="text-xs font-semibold text-foreground">
                              {firstItem.gender === "FEMALE" ? "母蟹" : "公蟹"} {firstItem.weightTier}
                            </div>

                            {/* 第三行: 数量 */}
                            <div className="text-[11px] font-mono text-muted-foreground">
                              {firstItem.inPoolCount.toLocaleString()} 只
                            </div>
                          </div>
                        </TableCell>

                        {/* 4. 在池存活与流转 */}
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-1 py-0.5 max-w-[115px]">
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                {liveInPool.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">只</span>
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {livePct}%
                              </span>
                            </div>
                            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
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
                          <div className="flex flex-col gap-1 max-w-[125px]">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <InspectionTag
                                status={batch.quickCheck}
                                url={batch.quickCheckUrl || batch.reportUrl}
                                label="农残"
                                batchCode={batch.code}
                                reportName={batch.quickCheckName || batch.reportName}
                              />
                              <InspectionTag
                                status={batch.sampleCheck}
                                url={batch.sampleCheckUrl}
                                label="试吃"
                                batchCode={batch.code}
                                reportName={batch.sampleCheckName}
                              />
                            </div>

                            {(isQaOrAdmin || isWarehouseOrAdmin) && isPendingQc && (
                              <BatchInspectionDialog
                                batch={batch}
                                userId={currentUserId}
                                trigger={
                                  <button
                                    type="button"
                                    className="text-[10px] text-left cursor-pointer transition-colors inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-1 py-0.5 rounded w-fit whitespace-nowrap"
                                  >
                                    <ClipboardCheck className="size-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span>录入检测</span>
                                  </button>
                                }
                              />
                            )}
                          </div>
                        </TableCell>

                        {/* 6. 批次状态 */}
                        <TableCell className="align-middle">
                          {batch.status === "FROZEN" ? (
                            <Badge variant="destructive" className="font-normal text-[11px] py-0 px-1.5">
                              <span className="size-1.5 rounded-full bg-white animate-pulse mr-1 inline-block" />
                              冻结
                            </Badge>
                          ) : batch.status === "TEMPORARY_HOLDING" ? (
                            <Badge variant="outline" className="font-normal text-[11px] py-0 px-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                              <span className="size-1.5 rounded-full bg-emerald-500 mr-1 inline-block" />
                              暂养
                            </Badge>
                          ) : (
                            <Badge variant={batch.status === "COMPLETED" ? "outline" : "secondary"} className="font-normal text-[11px] py-0 px-1.5">
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
                            isAdmin={isAdmin}
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
