import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { formatDateTime } from "@/lib/utils";
import { Invariants } from "@/lib/invariants";

export const dynamic = "force-dynamic";

export default async function BundlingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const selectedDateStr = params?.date?.trim();

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
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      group: true,
      tagClaim: { include: { farmer: true } },
      lines: { include: { pool: true } },
    },
  });

  // 5. 查询捆扎巡检记录 (11.4 捆扎巡检)
  const bundleQCs = await prisma.qCRecord.findMany({
    where: {
      cat: "BUNDLE_INSPECT",
      ...(dateFilter ? { checkTime: dateFilter } : {}),
    },
    orderBy: [{ checkTime: "desc" }, { uploadTime: "desc" }],
  });

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

      {/* 捆扎组工作台卡片 (11.2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {groups.map((g: any) => {
          const totalCrabs = g.batches.reduce(
            (acc: number, b: any) => acc + b.lines.reduce((lAcc: number, l: any) => lAcc + l.count, 0),
            0
          );
          const isBundling = g.batches.some((b: any) => b.status === "BUNDLING");

          return (
            <Card key={g.id} className="border-border/80 shadow-xs">
              <CardHeader className="py-2 px-3 border-b bg-muted/20 flex flex-row items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" />
                  <CardTitle className="text-xs font-semibold">{g.name}</CardTitle>
                </div>
                <Badge
                  variant={isBundling ? "default" : "secondary"}
                  className={
                    isBundling
                      ? "bg-amber-500 text-white text-[10px] animate-pulse"
                      : "text-[10px]"
                  }
                >
                  {isBundling ? "捆扎作业中" : "待命中 / 空闲"}
                </Badge>
              </CardHeader>
              <CardContent className="p-3 grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-muted-foreground block">累计批次数</span>
                  <span className="text-sm font-bold text-foreground">{g.batches.length} 批</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">累计捆扎只数</span>
                  <span className="text-sm font-bold text-primary">{totalCrabs} 只</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 捆扎批次台账 (11.3) */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="py-2 px-3.5 border-b bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckSquare className="size-3.5 text-primary" />
            <CardTitle className="text-xs font-semibold">捆扎批次台账（共 {batches.length} 批）</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-mono">
              <tr>
                <th className="px-3 py-2 font-medium">捆扎批次号 (KZD)</th>
                <th className="px-3 py-2 font-medium">班组</th>
                <th className="px-3 py-2 font-medium">绑定蟹扣 (XK)</th>
                <th className="px-3 py-2 font-medium">蟹绳批次</th>
                <th className="px-3 py-2 font-medium">来源暂养池明细</th>
                <th className="px-3 py-2 font-medium">合计只数</th>
                <th className="px-3 py-2 font-medium">作业状态</th>
                <th className="px-3 py-2 font-medium">完成时间</th>
                <th className="px-3 py-2 font-medium text-right">操作</th>
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
                      <td className="px-3 py-2 font-mono font-bold text-foreground">
                        {batch.code}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {batch.group.name} ({batch.group.code})
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-mono">
                        <div className="text-primary font-medium flex items-center gap-1">
                          <Tag className="size-3" />
                          {batch.tagClaim.code || "—"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {batch.tagClaim.farmer.name}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {batch.ropeBatch}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {batch.lines.map((l: any) => (
                            <span
                              key={l.id}
                              className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border"
                            >
                              {l.pool.name || l.pool.code} ({l.gender === "FEMALE" ? "母" : "公"}{l.weightTier}) · {l.count}只
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono font-bold text-foreground">
                        {totalCount} 只
                      </td>
                      <td className="px-3 py-2">
                        {batch.status === "COMPLETED" ? (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                            <CheckCircle2 className="size-3 mr-1" /> 已完成捆扎
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px] animate-pulse">
                            <Clock className="size-3 mr-1" /> 捆扎中 (禁止分拣)
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground text-[11px]">
                        {formatDateTime(batch.doneAt)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {batch.status === "BUNDLING" && (
                          <CompleteBundleButton bundleId={batch.id} code={batch.code} />
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

      {/* 捆扎巡检台账 (11.4 捆扎巡检：不关联批次，重点比对巡检时间与上传时间) */}
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
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-mono">
              <tr>
                <th className="px-3 py-2 font-medium">巡检记录号 (KZ)</th>
                <th className="px-3 py-2 font-medium">纸质表号</th>
                <th className="px-3 py-2 font-medium">现场巡检时间</th>
                <th className="px-3 py-2 font-medium">系统上传时间</th>
                <th className="px-3 py-2 font-medium">巡检结论判定</th>
                <th className="px-3 py-2 font-medium">质检责任人</th>
                <th className="px-3 py-2 font-medium text-right">原始凭证</th>
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
                      <td className="px-3 py-2 font-mono font-bold text-foreground">
                        {qc.code}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {qc.formNo || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        <div className="flex items-center gap-1 font-medium text-foreground">
                          <Clock className="size-3 text-muted-foreground" />
                          {checkStr}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Upload className="size-3 text-muted-foreground" />
                          {uploadStr}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {isException ? (
                          <div className="space-y-0.5">
                            <Badge variant="destructive" className="text-[10px]">
                              <AlertTriangle className="size-3 mr-1" />
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
                            <CheckCircle2 className="size-3 mr-1" />
                            {qc.conclusion || "全部合格，正常作业放行"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {qc.uploader}
                      </td>
                      <td className="px-3 py-2 text-right">
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
    </div>
  );
}
