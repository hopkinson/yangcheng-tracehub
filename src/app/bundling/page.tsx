import Link from "next/link";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BundleBatchDialog } from "@/components/bundling/BundleBatchDialog";
import { BundleGroupDialog } from "@/components/bundling/BundleGroupDialog";
import { CompleteBundleButton } from "@/components/bundling/CompleteBundleButton";
import { QCRecordDialog } from "@/components/qc/QCRecordDialog";
import { QCViewDialog } from "@/components/qc/QCViewDialog";
import { LedgerDateFilter } from "@/components/ledgers/LedgerDateFilter";
import {
  Layers,
  Users,
  Tag,
  CheckCircle2,
  Clock,
  CheckSquare,
  ClipboardCheck,
  AlertTriangle,
  Upload,
  X,
} from "lucide-react";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { formatDateTime, cn } from "@/lib/utils";
import { Invariants } from "@/lib/invariants";

export const dynamic = "force-dynamic";

export default async function BundlingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; group?: string }>;
}) {
  const params = await searchParams;
  const selectedDateStr = params?.date?.trim();
  const selectedGroupId = params?.group?.trim();

  const dateFilter = selectedDateStr
    ? { gte: startOfDay(parseISO(selectedDateStr)), lte: endOfDay(parseISO(selectedDateStr)) }
    : undefined;

  // 1. 查询捆扎组与批次统计
  const groups = await prisma.bundleGroup.findMany({
    orderBy: { code: "asc" },
    include: {
      _count: { select: { batches: true } },
      batches: {
        include: { lines: true },
      },
    },
  });

  // 2. 查询可用于捆扎的已审批蟹扣 (status=APPROVED)
  const approvedTagClaims = await prisma.tagClaim.findMany({
    where: { status: "APPROVED" },
    include: {
      farmer: true,
      bundleBatches: { include: { lines: true } },
    },
    orderBy: { claimDate: "desc" },
  });

  // 3. 查询暂养池及其在池存活
  const rawPools = await prisma.holdingPool.findMany({
    where: { status: "ACTIVE" },
    include: {
      batches: {
        where: { status: { not: "FROZEN" } },
      },
      batchItems: {
        where: { batch: { status: { not: "FROZEN" } } },
      },
    },
    orderBy: { code: "asc" },
  });

  const poolOptions = rawPools.map((p: any) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    currentGender: p.currentGender,
    currentWeightTier: p.currentWeightTier,
    liveCount: Invariants.calculatePoolLiveCount(p),
  }));

  // 4. 查询捆扎批次
  const batches = await prisma.bundleBatch.findMany({
    where: {
      ...(selectedGroupId ? { groupId: selectedGroupId } : {}),
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      group: true,
      tagClaim: { include: { farmer: true } },
      lines: { include: { pool: true } },
    },
  });

  const selectedGroup = selectedGroupId ? groups.find((g: any) => g.id === selectedGroupId) : null;

  // 5. 查询捆扎巡检记录 (11.4 捆扎巡检)
  const bundleQCs = await prisma.qCRecord.findMany({
    where: {
      cat: "BUNDLE_INSPECT",
      ...(dateFilter ? { checkTime: dateFilter } : {}),
    },
    orderBy: [{ checkTime: "desc" }, { uploadTime: "desc" }],
  });

  const isBundlingActive = batches.some((b: any) => b.status === "BUNDLING");
  const totalBatchesAll = groups.reduce((acc: number, g: any) => acc + g.batches.length, 0);
  const totalCrabsAll = groups.reduce(
    (acc: number, g: any) =>
      acc + g.batches.reduce((bAcc: number, b: any) => bAcc + b.lines.reduce((lAcc: number, l: any) => lAcc + l.count, 0), 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* 头部标题与操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="size-4.5 text-primary" />
            捆扎管理
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            蟹扣批次与暂养批次的物理与身份绑定 · 严禁混扣混源头 · 只有完成捆扎方可进入分拣
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BundleGroupDialog groups={groups} />
          <BundleBatchDialog
            groups={groups.map((g: any) => ({ id: g.id, code: g.code, name: g.name }))}
            tagClaims={approvedTagClaims.map((t: any) => {
              const used = t.bundleBatches?.flatMap((b: any) => b.lines || []).reduce((s: number, l: any) => s + l.count, 0) || 0;
              return {
                id: t.id,
                code: t.code,
                farmerName: t.farmer.name,
                claimCount: t.claimCount,
                availableCount: Math.max(0, t.claimCount - Math.max(used, t.boundCount || 0) - (t.returnedCount || 0) - (t.scrappedCount || 0)),
              };
            })}
            pools={poolOptions}
          />
        </div>
      </div>

      {/* 方案 A: Tab 标签分流工作台 (2 大核心业务视图) */}
      <Tabs defaultValue="batches" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b pb-2">
          <TabsList className="h-9 p-1">
            <TabsTrigger value="batches" className="gap-1.5 text-xs">
              <CheckSquare className="size-3.5" />
              捆扎作业与批次台账
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                {batches.length}
              </Badge>
              {isBundlingActive && (
                <span className="size-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20 animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="qc" className="gap-1.5 text-xs">
              <ClipboardCheck className="size-3.5" />
              工序质检与巡检留痕
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                {bundleQCs.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span>共 {groups.length} 个班组</span>
            {isBundlingActive && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                · 正在作业中
              </span>
            )}
            {selectedGroup && (
              <span className="text-primary font-medium">
                · 已按【{selectedGroup.name.replace(/-\d+_[a-z0-9]+$/i, "")}】筛选
              </span>
            )}
          </div>
        </div>

        {/* Tab 1: 捆扎作业与批次台账 (含工位即时联动与主台账) */}
        <TabsContent value="batches" className="m-0 space-y-3">
            {/* 11.2 班组工位概览 (具备明确单选筛选隐喻与物理反馈的工位卡) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Users className="size-3.5 text-primary" />
                    班组工位概览
                  </span>
                  <span className="text-[11px]">（点击工位卡片联动筛选下方台账）</span>
                </div>
                {selectedGroupId && (
                  <Link
                    href={selectedDateStr ? `/bundling?date=${selectedDateStr}` : "/bundling"}
                    className="text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-0.5 hover:underline font-medium"
                  >
                    <X className="size-3" /> 重置筛选
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {/* 1. 全部班组主控卡（默认锚点） */}
                <Link
                  href={selectedDateStr ? `/bundling?date=${selectedDateStr}` : "/bundling"}
                  className={cn(
                    "p-2.5 rounded-lg border transition-all text-left flex flex-col justify-between gap-1.5 cursor-pointer group select-none",
                    "hover:-translate-y-0.5 hover:shadow-xs active:scale-[0.98]",
                    !selectedGroupId
                      ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                      : "bg-card border-border/80 hover:border-primary/50 hover:bg-muted/30"
                  )}
                  title="查看所有班组台账"
                >
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      全部班组
                    </span>
                    {!selectedGroupId ? (
                      <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                    ) : (
                      <span className="size-3.5 rounded-full border border-muted-foreground/30 group-hover:border-primary/50 shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-muted-foreground">{totalBatchesAll} 批</span>
                    <span className={totalCrabsAll > 0 ? "text-primary font-semibold" : "text-muted-foreground"}>
                      {totalCrabsAll.toLocaleString()} 只
                    </span>
                  </div>
                </Link>

                {/* 2. 各班组工位卡 */}
                {groups.map((g: any) => {
                  const totalCrabs = g.batches.reduce(
                    (acc: number, b: any) => acc + b.lines.reduce((lAcc: number, l: any) => lAcc + l.count, 0),
                    0
                  );
                  const isBundling = g.batches.some((b: any) => b.status === "BUNDLING");
                  const isSelected = selectedGroupId === g.id;
                  const cleanName = g.name.replace(/-\d+_[a-z0-9]+$/i, "");

                  const query = new URLSearchParams();
                  if (selectedDateStr) query.set("date", selectedDateStr);
                  if (!isSelected) query.set("group", g.id);
                  const href = query.toString() ? `/bundling?${query.toString()}` : "/bundling";

                  return (
                    <Link
                      key={g.id}
                      href={href}
                      className={cn(
                        "p-2.5 rounded-lg border transition-all text-left flex flex-col justify-between gap-1.5 cursor-pointer group select-none",
                        "hover:-translate-y-0.5 hover:shadow-xs active:scale-[0.98]",
                        isSelected
                          ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                          : "bg-card border-border/80 hover:border-primary/50 hover:bg-muted/30"
                      )}
                      title={g.name}
                    >
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={cn(
                              "size-2 rounded-full shrink-0",
                              isBundling
                                ? "bg-amber-500 animate-pulse ring-2 ring-amber-500/20"
                                : "bg-muted-foreground/30"
                            )}
                          />
                          <span className="text-xs font-semibold truncate text-foreground">
                            {cleanName}
                          </span>
                        </div>
                        {isSelected ? (
                          <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                        ) : (
                          <span className="size-3.5 rounded-full border border-muted-foreground/30 group-hover:border-primary/50 shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-muted-foreground">
                          {isBundling ? (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium font-sans">
                              作业中
                            </span>
                          ) : (
                            `${g.batches.length} 批`
                          )}
                        </span>
                        <span className={totalCrabs > 0 ? "text-primary font-semibold" : "text-muted-foreground"}>
                          {totalCrabs.toLocaleString()} 只
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

          {/* 11.3 捆扎批次台账 */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="py-2 px-3.5 border-b bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckSquare className="size-3.5 text-primary" />
            <CardTitle className="text-xs font-semibold">
              捆扎批次台账（{selectedGroup ? `已筛选: ${selectedGroup.name.replace(/-\d+_[a-z0-9]+$/i, "")} · ` : ""}共 {batches.length} 批）
            </CardTitle>
          </div>
          {selectedGroupId && (
            <Link
              href={selectedDateStr ? `/bundling?date=${selectedDateStr}` : "/bundling"}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground bg-background px-2 py-0.5 rounded border border-border/80 hover:border-border transition-colors"
            >
              <X className="size-3" />
              清除班组筛选
            </Link>
          )}
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-mono">
              <tr>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[150px]">捆扎批次号 (KZD)</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[120px]">班组</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[150px]">绑定蟹扣 (XK)</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[120px]">蟹绳批次</th>
                <th className="px-3 py-2.5 font-medium min-w-[240px]">来源暂养池明细</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[130px]">合计只数</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[140px]">作业状态</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[130px]">完成时间</th>
                <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap w-[90px]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-muted-foreground">
                    暂无捆扎批次，请点击右上角「新建捆扎批次 (KZD)」
                  </td>
                </tr>
              ) : (
                batches.map((batch: any) => {
                  const totalCount = batch.lines.reduce((a: number, b: any) => a + b.count, 0);

                  return (
                    <tr key={batch.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2 font-mono font-bold text-foreground whitespace-nowrap">
                        {batch.code}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-muted/60 text-foreground border border-border/70 leading-none">
                          {batch.group.name.replace(/-\d+_[a-z0-9]+$/i, "").replace(/_\d+$/i, "")}
                          {batch.group.code && /^P\d+$/i.test(batch.group.code) ? `(${batch.group.code})` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        <div className="text-primary font-medium flex items-center gap-1">
                          <Tag className="size-3 shrink-0" />
                          <span>{batch.tagClaim.code || "—"}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {batch.tagClaim.farmer.name}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                        {batch.ropeBatch}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {batch.lines.map((l: any) => (
                            <span
                              key={l.id}
                              className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border whitespace-nowrap"
                            >
                              {l.pool.name || l.pool.code} ({l.gender === "FEMALE" ? "母" : "公"}{l.weightTier}) · {l.count}只
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {batch.status === "COMPLETED" ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-foreground">
                              {(batch.qualifiedCount || totalCount).toLocaleString()} 只
                            </div>
                            {batch.lossCount > 0 ? (
                              <div
                                className={cn(
                                  "text-[10px]",
                                  batch.lossRate > 5
                                    ? "text-destructive font-bold"
                                    : "text-muted-foreground"
                                )}
                              >
                                损耗 {batch.lossCount} 只 ({batch.lossRate}%)
                              </div>
                            ) : (
                              <div className="text-[10px] text-muted-foreground">0 损耗</div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="font-bold text-foreground">
                              {totalCount.toLocaleString()} 只
                            </div>
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-sans">
                              投入 (待完工)
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {batch.status === "COMPLETED" ? (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                            <CheckCircle2 className="size-3 mr-1 shrink-0" /> 已完成捆扎
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px] animate-pulse">
                            <Clock className="size-3 mr-1 shrink-0" /> 捆扎中 (禁止分拣)
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground text-[11px] whitespace-nowrap">
                        {batch.doneAt ? formatDateTime(batch.doneAt) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {batch.status === "BUNDLING" ? (
                          <CompleteBundleButton
                            bundleId={batch.id}
                            code={batch.code}
                            lines={batch.lines}
                          />
                        ) : (
                          <span className="text-muted-foreground/50 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </TabsContent>

    {/* Tab 3: 捆扎巡检台账 (11.4) */}
    <TabsContent value="qc" className="m-0 space-y-4">
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="py-2 px-3.5 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-primary shrink-0" />
            <div>
              <CardTitle className="text-xs font-semibold">捆扎现场与绑扣规范巡检台账</CardTitle>
              <p className="text-[11px] text-muted-foreground">
                车间现场巡检留痕 · 巡检时间（现场发生）与上传时间（系统登记）比对 · 两段结论合规判定
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <LedgerDateFilter selectedDate={selectedDateStr} />
            <QCRecordDialog
              config={{
                cat: "BUNDLE_INSPECT",
                categoryLabel: "捆扎巡检",
                defaultTitle: "车间捆扎现场作业与绑扣规范巡检记录表",
                formNoPreset: "YCGF-PZZX-202606",
                refType: "WORKSHOP",
                refId: "BZ-WORKSHOP",
                conclusions: [
                  "全部合格，正常作业放行",
                  "存在问题，暂停整改",
                ],
              }}
              triggerLabel="登记捆扎巡检"
            />
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-mono">
              <tr>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[150px]">巡检记录号 (KZ)</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[140px]">纸质表号</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[150px]">现场巡检时间</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[150px]">系统上传时间</th>
                <th className="px-3 py-2.5 font-medium min-w-[200px]">巡检结论判定</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[110px]">质检责任人</th>
                <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap w-[100px]">原始凭证</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {bundleQCs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-muted-foreground">
                    {selectedDateStr ? `选定日期 (${selectedDateStr}) 无巡检记录` : "暂无捆扎巡检记录，请点击右上角「登记捆扎巡检」"}
                  </td>
                </tr>
              ) : (
                bundleQCs.map((qc: any) => {
                  const isException = qc.result === "EXCEPTION";
                  const checkStr = formatDateTime(qc.checkTime);
                  const uploadStr = formatDateTime(qc.uploadTime);

                  return (
                    <tr key={qc.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2 font-mono font-bold text-foreground whitespace-nowrap">
                        {qc.code}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                        {qc.formNo || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1 font-medium text-foreground">
                          <Clock className="size-3 text-muted-foreground shrink-0" />
                          {checkStr}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Upload className="size-3 text-muted-foreground shrink-0" />
                          {uploadStr}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {isException ? (
                          <div className="space-y-0.5">
                            <Badge variant="destructive" className="text-[10px]">
                              <AlertTriangle className="size-3 mr-1 shrink-0" />
                              {qc.conclusion || "存在问题，暂停整改"}
                            </Badge>
                            {qc.reason && (
                              <div className="text-[10px] text-destructive leading-tight">
                                原因: {qc.reason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                            <CheckCircle2 className="size-3 mr-1 shrink-0" />
                            {qc.conclusion || "全部合格，正常作业放行"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {qc.uploader}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <QCViewDialog record={qc} triggerText="查看留痕" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </TabsContent>
  </Tabs>
</div>
  );
}
