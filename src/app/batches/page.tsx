import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSpecIntakeDialog } from "@/components/batches/MultiSpecIntakeDialog";
import { BatchDetailDialog } from "@/components/batches/BatchDetailDialog";
import { BatchRowActions } from "@/components/batches/BatchRowActions";
import { BatchLossHistoryDialog } from "@/components/batches/BatchLossHistoryDialog";
import { BatchReportViewDialog } from "@/components/batches/BatchReportViewDialog";
import { QCRecordDialog } from "@/components/qc/QCRecordDialog";
import { QCViewDialog } from "@/components/qc/QCViewDialog";
import { BatchFilterSelect } from "@/components/qc/BatchFilterSelect";
import { LedgerDateFilter } from "@/components/ledgers/LedgerDateFilter";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { cn, formatDateTime, getBeijingDayRange, getBeijingYear } from "@/lib/utils";
import { Invariants } from "@/lib/invariants";
import { StaggerContainer, FadeIn } from "@/components/motion/MotionWrapper";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertTriangle,
  Layers,
  ClipboardList,
  ArrowRight,
  ShieldCheck,
  Utensils,
  Pencil,
} from "lucide-react";

export const dynamic = "force-dynamic";

const QUICK_QC_PRESET = {
  cat: "QUICK_CHECK",
  categoryLabel: "药残及重金属快检",
  defaultTitle: "药残及重金属快检",
  formNoPreset: "YCGF-PZZX-202601",
  refType: "BATCH",
};

const TASTE_QC_PRESET = {
  cat: "TASTE_CHECK",
  categoryLabel: "品质抽检与试吃记录表",
  defaultTitle: "品质抽检与试吃记录",
  formNoPreset: "YCGF-PZZX-202602",
  refType: "BATCH",
};

function InspectionTag({
  status,
  url,
  label,
  batchCode,
  reportName,
  editable = false,
}: {
  status?: string | null;
  url?: string | null;
  label: string;
  batchCode: string;
  reportName?: string | null;
  editable?: boolean;
}) {
  const isQualified = status === "QUALIFIED";
  const isUnqualified = status === "UNQUALIFIED";
  const isRectifying = status === "RECTIFYING";

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
    const content = <><XCircle className="size-2.5 shrink-0" /> {label}不合格</>;
    if (editable) {
      return (
        <button type="button" className="inline-flex items-center gap-0.5 text-[10px] text-destructive font-medium whitespace-nowrap hover:underline cursor-pointer" title="点击重新质检/复查">
          {content}
        </button>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive font-medium whitespace-nowrap">
        {content}
      </span>
    );
  }
  if (isRectifying) {
    const content = <><AlertTriangle className="size-2.5 shrink-0" /> {label}待整改</>;
    if (editable) {
      return (
        <button type="button" className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-500 font-medium whitespace-nowrap hover:underline cursor-pointer" title="点击重新登记整改后质检">
          {content}
        </button>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-500 font-medium whitespace-nowrap">
        {content}
      </span>
    );
  }
  const content = <><Clock className="size-2.5 shrink-0" /> {label}待检</>;
  if (editable) {
    return (
      <button type="button" className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-medium whitespace-nowrap hover:underline cursor-pointer">
        {content}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-medium whitespace-nowrap">
      {content}
    </span>
  );
}

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    tab?: string;
    cat?: string;
    batch?: string;
    date?: string;
  }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab === "qc" ? "qc" : "batches";
  const selectedDateStr = params.date?.trim();
  const selectedCat = params.cat?.trim();
  const selectedBatch = params.batch?.trim();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 10);

  const dateFilter = selectedDateStr ? getBeijingDayRange(selectedDateStr) : undefined;

  const [
    currentUser,
    totalBatches,
    batches,
    farmers,
    pools,
    allBatchesForFilter,
    totalQCRecordsCount,
    batchQCRecords,
  ] = await Promise.all([
    getCurrentUser(),
    prisma.batch.count(),
    prisma.batch.findMany({
      skip: activeTab === "batches" ? (page - 1) * pageSize : 0,
      take: activeTab === "batches" ? pageSize : 50,
      include: {
        farmer: true,
        enclosure: true,
        pool: true,
        items: { include: { pool: true } },
        lossRecords: {
          include: { inspector: true },
          orderBy: { createdAt: "desc" },
        },
        bundleBatches: {
          include: {
            group: true,
            lines: { include: { pool: true } },
            sortTasks: {
              include: {
                machine: true,
                coldLogs: {
                  include: {
                    store: true,
                    outboundLosses: { include: { operator: true } },
                  },
                },
              },
            },
          },
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
    prisma.batch.findMany({
      select: { id: true, code: true, farmer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.qCRecord.count({
      where: {
        refType: "BATCH",
        cat: { in: ["QUICK_CHECK", "TASTE_CHECK"] },
      },
    }),
    prisma.qCRecord.findMany({
      where: {
        refType: "BATCH",
        cat: { in: ["QUICK_CHECK", "TASTE_CHECK"] },
        ...(selectedCat ? { cat: selectedCat } : {}),
        ...(dateFilter ? { checkTime: dateFilter } : {}),
        ...(selectedBatch && selectedBatch !== "ALL" ? { refId: selectedBatch } : {}),
      },
      orderBy: { checkTime: "desc" },
    }),
  ]);

  const batchCodes = batches.map((b: any) => b.code);
  const batchQCForBatches = batchCodes.length > 0 ? await prisma.qCRecord.findMany({
    where: {
      refType: "BATCH",
      refId: { in: batchCodes },
      cat: { in: ["QUICK_CHECK", "TASTE_CHECK"] },
    },
    orderBy: { checkTime: "desc" },
  }) : [];

  const qcByBatchAndCat = new Map<string, any>();
  for (const q of batchQCForBatches) {
    const key = `${q.refId}_${q.cat}`;
    if (!qcByBatchAndCat.has(key)) {
      qcByBatchAndCat.set(key, q);
    }
  }

  const currentUserId = currentUser?.id || "";
  const isAdmin = currentUser?.role === "ADMIN";
  const isQaOrAdmin = currentUser?.role === "QA_DIRECTOR" || isAdmin;
  const isWarehouseOrAdmin = currentUser?.role === "WAREHOUSE_ADMIN" || isAdmin;
  const canEditQc = isQaOrAdmin || isWarehouseOrAdmin;

  // 格式化养殖户入池额度 (按自然年度与面积*600硬卡控)
  const farmerOptions = farmers.map((f: any) => {
    const currentYearBatches = f.batches.filter(
      (b: any) => getBeijingYear(b.inPoolTime) === f.year
    );
    const cumulative = currentYearBatches.reduce((sum: number, b: any) => sum + b.inPoolCount, 0);
    const maxQuota = Invariants.calculateQuota(f.area);
    return {
      id: f.id,
      name: f.name,
      code: f.code,
      area: f.area,
      quota: maxQuota,
      remainingQuota: Math.max(0, maxQuota - cumulative),
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

  // 品控台账分页切片
  const filteredQCTotal = batchQCRecords.length;
  const currentQCPage = Math.min(page, Math.ceil(filteredQCTotal / pageSize) || 1);
  const pagedQCRecords = batchQCRecords.slice((currentQCPage - 1) * pageSize, currentQCPage * pageSize);

  // 品控录入批次选项
  const batchRefOptions = allBatchesForFilter.map((b) => ({
    label: `${b.code} (${b.farmer?.name || "未知养殖户"})`,
    value: b.code,
  }));

  const activeBatchRefId = selectedBatch && selectedBatch !== "ALL" ? selectedBatch : (allBatchesForFilter[0]?.code || "");
  const qcBase = `${selectedBatch ? `&batch=${selectedBatch}` : ""}${selectedDateStr ? `&date=${selectedDateStr}` : ""}`;

  return (
    <StaggerContainer className="flex flex-col gap-6">
      {/* 顶部标题与多规格码单录入 */}
      <FadeIn direction="down" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="size-6 text-primary" />
            原料批次
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            原料大闸蟹多规格入库码单流水 · 药残及重金属快检与品质试吃双时间戳合规品控留痕
          </p>
        </div>
        {isWarehouseOrAdmin && (
          <div className="flex items-center gap-2">
            <MultiSpecIntakeDialog farmers={farmerOptions} pools={poolOptions} userId={currentUserId} />
          </div>
        )}
      </FadeIn>

      {/* 主选项卡：原料批次列表 vs 原料品控留痕台账（对齐暂养监控逻辑） */}
      <Tabs defaultValue={activeTab} className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-2.5">
          <TabsList className="grid w-full sm:w-auto grid-cols-2 h-9">
            <TabsTrigger value="batches" asChild>
              <Link
                href="/batches?tab=batches"
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <Layers className="size-3.5" />
                原料批次列表 ({totalBatches})
              </Link>
            </TabsTrigger>
            <TabsTrigger value="qc" asChild>
              <Link
                href={`/batches?tab=qc${selectedCat ? `&cat=${selectedCat}` : ""}${selectedBatch ? `&batch=${selectedBatch}` : ""}${selectedDateStr ? `&date=${selectedDateStr}` : ""}`}
                className="flex items-center gap-1.5 text-xs font-medium"
              >
                <ClipboardList className="size-3.5" />
                品控留痕台账 ({totalQCRecordsCount})
              </Link>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: 原料批次列表 */}
        <TabsContent value="batches" className="flex flex-col gap-4 mt-0">
          <FadeIn>
            <Card>
              <CardContent className="p-4">
                <div className="rounded-md border overflow-x-auto">
                  <Table className="min-w-[1020px]">
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[140px] min-w-[130px]">批次号 / 码单表号</TableHead>
                        <TableHead className="w-[130px] min-w-[120px]">来源养殖户</TableHead>
                        <TableHead className="w-[240px] min-w-[220px]">入库规格明细</TableHead>
                        <TableHead className="w-[110px] min-w-[100px]">入库合计</TableHead>
                        <TableHead className="w-[110px] min-w-[100px]">总损耗</TableHead>
                        <TableHead className="w-[140px] min-w-[130px]">品控快检 / 抽检</TableHead>
                        <TableHead className="w-[85px] min-w-[70px]">状态</TableHead>
                        <TableHead className="text-right w-[100px] min-w-[90px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.map((batch: any) => {
                        const hasMultiItems = batch.items && batch.items.length > 0;
                        const displayItems = hasMultiItems
                          ? batch.items
                          : [
                              {
                                id: batch.id,
                                pool: batch.pool,
                                gender: batch.gender,
                                weightTier: batch.weightTier,
                                inPoolCount: batch.inPoolCount,
                                weight: null,
                              },
                            ];
                        const totalWeight = batch.items?.reduce((sum: number, it: any) => sum + (Number(it.weight) || 0), 0) ?? 0;
                        const stageLoss = Invariants.calculateBatchLifecycleLoss(batch);

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

                            {/* 3. 码单多规格明细 */}
                            <TableCell className="align-middle min-w-[240px]">
                              <div className="flex flex-col gap-1 py-0.5">
                                {displayItems.map((it: any) => (
                                  <div
                                    key={it.id}
                                    className="flex items-center justify-between text-xs py-0.5 border-b last:border-0 border-border/30 gap-2"
                                  >
                                    <span
                                      className="font-mono text-[11px] text-muted-foreground truncate max-w-[90px]"
                                      title={it.pool?.name || it.pool?.code || "暂养池"}
                                    >
                                      {it.pool?.name || it.pool?.code || "暂养池"}
                                    </span>
                                    <span className="font-medium text-foreground text-[11px]">
                                      {it.gender === "FEMALE" ? "母蟹" : "公蟹"} {it.weightTier}
                                    </span>
                                    <span className="font-mono font-semibold text-foreground text-[11px] whitespace-nowrap">
                                      {it.inPoolCount.toLocaleString()} 只
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>

                            {/* 4. 入库合计 */}
                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-0.5 py-0.5">
                                <span className="font-mono font-bold text-xs text-foreground">
                                  {batch.inPoolCount.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">只</span>
                                </span>
                                {totalWeight > 0 ? (
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    {totalWeight.toFixed(1)} 斤
                                  </span>
                                ) : hasMultiItems && batch.items.length > 1 ? (
                                  <span className="text-[10px] text-muted-foreground">
                                    共 {batch.items.length} 档规格
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>

                            {/* 5. 总损耗 */}
                            <TableCell className="align-middle">
                              <BatchLossHistoryDialog
                                batch={batch}
                                trigger={
                                  <button
                                    type="button"
                                    className="flex flex-col gap-0.5 py-0.5 text-left cursor-pointer group"
                                    title="点击查看全环节损耗台账与明细履历"
                                  >
                                    <div
                                      className={cn(
                                        "font-mono font-bold text-xs inline-flex items-center gap-1 group-hover:underline",
                                        stageLoss.isLossOverLimit
                                          ? "text-destructive"
                                          : stageLoss.totalLoss > 0
                                          ? "text-foreground"
                                          : "text-muted-foreground"
                                      )}
                                    >
                                      <span>{stageLoss.totalLoss.toLocaleString()} 只</span>
                                      {stageLoss.isLossOverLimit && (
                                        <AlertTriangle className="size-3 text-destructive shrink-0" />
                                      )}
                                    </div>
                                    <span
                                      className={cn(
                                        "text-[10px] font-mono",
                                        stageLoss.isLossOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
                                      )}
                                    >
                                      损耗率 {stageLoss.totalLossRate.toFixed(1)}%
                                    </span>
                                  </button>
                                }
                              />
                            </TableCell>

                            {/* 6. 品控快检/抽检与台账穿透 */}
                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-1 max-w-[135px]">
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                  {(() => {
                                    const quickQC = qcByBatchAndCat.get(`${batch.code}_QUICK_CHECK`);
                                    return canEditQc && batch.quickCheck !== "QUALIFIED" ? (
                                      <QCRecordDialog
                                        config={{ ...QUICK_QC_PRESET, refId: batch.code }}
                                        record={quickQC}
                                        trigger={
                                          <InspectionTag
                                            status={batch.quickCheck}
                                            url={batch.quickCheckUrl || batch.reportUrl}
                                            label="农残"
                                            batchCode={batch.code}
                                            reportName={batch.quickCheckName || batch.reportName}
                                            editable
                                          />
                                        }
                                      />
                                    ) : (
                                      <InspectionTag
                                        status={batch.quickCheck}
                                        url={batch.quickCheckUrl || batch.reportUrl}
                                        label="农残"
                                        batchCode={batch.code}
                                        reportName={batch.quickCheckName || batch.reportName}
                                      />
                                    );
                                  })()}
                                  {(() => {
                                    const sampleQC = qcByBatchAndCat.get(`${batch.code}_TASTE_CHECK`);
                                    return canEditQc && batch.sampleCheck !== "QUALIFIED" ? (
                                      <QCRecordDialog
                                        config={{ ...TASTE_QC_PRESET, refId: batch.code }}
                                        record={sampleQC}
                                        trigger={
                                          <InspectionTag
                                            status={batch.sampleCheck}
                                            url={batch.sampleCheckUrl}
                                            label="试吃"
                                            batchCode={batch.code}
                                            reportName={batch.sampleCheckName}
                                            editable
                                          />
                                        }
                                      />
                                    ) : (
                                      <InspectionTag
                                        status={batch.sampleCheck}
                                        url={batch.sampleCheckUrl}
                                        label="试吃"
                                        batchCode={batch.code}
                                        reportName={batch.sampleCheckName}
                                      />
                                    );
                                  })()}
                                </div>
                                <Link
                                  href={`/batches?tab=qc&batch=${batch.code}`}
                                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-medium mt-0.5"
                                  title={`查看批次 ${batch.code} 的品控留痕台账`}
                                >
                                  台账穿透 <ArrowRight className="size-2.5" />
                                </Link>
                              </div>
                            </TableCell>

                            {/* 7. 批次状态 */}
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

                            {/* 8. 操作 */}
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
        </TabsContent>

        {/* Tab 2: 原料品控留痕台账（对齐暂养监控逻辑） */}
        <TabsContent value="qc" className="flex flex-col gap-4 mt-0">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ClipboardList className="size-4 text-primary" />
                  原料品控留痕台账 (药残及重金属快检 / 抽检试吃)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  记录实际发生时间 vs 系统上传时间双时间戳留痕 · 支持按批次号/类别/日期精准检索与纸质原件穿透
                </p>
              </div>

              {canEditQc && (
                <div className="flex items-center flex-wrap gap-2">
                  <QCRecordDialog
                    config={{
                      ...QUICK_QC_PRESET,
                      refId: activeBatchRefId,
                      refOptions: batchRefOptions,
                    }}
                    triggerLabel="录入药残及重金属快检"
                  />
                  <QCRecordDialog
                    config={{
                      ...TASTE_QC_PRESET,
                      refId: activeBatchRefId,
                      refOptions: batchRefOptions,
                    }}
                    triggerLabel="录入抽检试吃"
                  />
                </div>
              )}
            </CardHeader>

            <CardContent className="flex flex-col gap-3">
              {/* 台账一体化过滤栏：类别 + 关联批次 + 巡检日期 + 重置 */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  {/* 类别胶囊切换 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-muted-foreground font-medium shrink-0 whitespace-nowrap">类别:</span>
                    <div className="inline-flex rounded-md bg-background/80 p-0.5 border shadow-xs">
                      <Link
                        href={`/batches?tab=qc${qcBase}`}
                        className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                          !selectedCat ? "bg-primary text-primary-foreground font-medium shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        全部类别
                      </Link>
                      <Link
                        href={`/batches?tab=qc&cat=QUICK_CHECK${qcBase}`}
                        className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap flex items-center gap-1 ${
                          selectedCat === "QUICK_CHECK" ? "bg-primary text-primary-foreground font-medium shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <ShieldCheck className="size-3" />
                        药残及重金属快检
                      </Link>
                      <Link
                        href={`/batches?tab=qc&cat=TASTE_CHECK${qcBase}`}
                        className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap flex items-center gap-1 ${
                          selectedCat === "TASTE_CHECK" ? "bg-primary text-primary-foreground font-medium shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Utensils className="size-3" />
                        品质抽检/试吃
                      </Link>
                    </div>
                  </div>

                  <div className="h-4 w-px bg-border/80 hidden sm:block shrink-0" />

                  {/* 关联批次下拉选择 */}
                  <BatchFilterSelect batches={allBatchesForFilter} selectedBatch={selectedBatch} />

                  <div className="h-4 w-px bg-border/80 hidden sm:block shrink-0" />

                  {/* 巡检日期 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-muted-foreground font-medium shrink-0 whitespace-nowrap">巡检日期:</span>
                    <LedgerDateFilter selectedDate={selectedDateStr} />
                  </div>
                </div>

                {(selectedCat || selectedBatch || selectedDateStr) && (
                  <Link
                    href="/batches?tab=qc"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0 whitespace-nowrap"
                  >
                    重置筛选
                  </Link>
                )}
              </div>

              {/* 表格 */}
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs">
                      <TableHead className="w-[130px]">记录编号</TableHead>
                      <TableHead className="w-[170px]">记录类别 / 表号</TableHead>
                      <TableHead className="w-[130px]">关联批次</TableHead>
                      <TableHead className="w-[150px]">记录时间</TableHead>
                      <TableHead className="w-[150px]">系统上传时间</TableHead>
                      <TableHead className="w-[100px]">判定结果</TableHead>
                      <TableHead>检查结论 / 异常整改说明</TableHead>
                      <TableHead className="w-[90px]">质检员</TableHead>
                      <TableHead className="w-[80px] text-right">纸质原件</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedQCRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center text-xs text-muted-foreground">
                          暂无符合条件的原料品控记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedQCRecords.map((record: any) => {
                        const isUnqualified = record.result === "UNQUALIFIED" || record.conclusion === "不合格";
                        const isRectifying = record.result === "RECTIFYING" || record.conclusion === "待整改" || /整改|需复核/.test(record.conclusion || "");
                        const isException = record.result === "EXCEPTION";
                        const isQuick = record.cat === "QUICK_CHECK";

                        return (
                          <TableRow key={record.id} className="text-xs hover:bg-muted/30">
                            <TableCell className="font-mono font-medium text-foreground">
                              {record.code}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium flex items-center gap-1">
                                  {isQuick ? (
                                    <ShieldCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <Utensils className="size-3 text-indigo-500" />
                                  )}
                                  {isQuick ? "药残及重金属快检" : "品质抽检与试吃记录"}
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {record.formNo || (isQuick ? "YCGF-PZZX-202601" : "YCGF-PZZX-202602")}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-[11px]">
                                {record.refId}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="size-3 text-primary" />
                                {formatDateTime(record.checkTime)}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              <span className="flex items-center gap-1 text-[11px]">
                                {formatDateTime(record.uploadTime)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {isUnqualified ? (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                  不合格
                                </Badge>
                              ) : isException ? (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                  异常
                                </Badge>
                              ) : isRectifying ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                                  待整改
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                  合格
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5 max-w-[320px]">
                                <span className="text-foreground truncate">{record.conclusion}</span>
                                {record.reason && (
                                  <span className="text-[11px] text-destructive truncate">
                                    整改说明: {record.reason}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{record.uploader}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {canEditQc && (
                                  <QCRecordDialog
                                    config={{
                                      cat: record.cat,
                                      categoryLabel: record.cat === "QUICK_CHECK" ? "药残及重金属快检" : "品质抽检/试吃",
                                      defaultTitle: record.title,
                                      refType: record.refType,
                                      refId: record.refId,
                                      formNoPreset: record.formNo || undefined,
                                    }}
                                    record={record}
                                    trigger={
                                      <button
                                        type="button"
                                        className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer mr-1"
                                        title="修改品控记录"
                                      >
                                        <Pencil className="size-3" /> 编辑
                                      </button>
                                    }
                                  />
                                )}
                                <QCViewDialog record={record} triggerText="查看原件" />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 标准分页组件 */}
              <DataTablePagination
                total={filteredQCTotal}
                page={currentQCPage}
                pageSize={pageSize}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </StaggerContainer>
  );
}
