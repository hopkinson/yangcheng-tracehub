"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, History, Layers, Package, Scissors, Scale, Snowflake } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Invariants } from "@/lib/invariants";

export interface BatchLossHistoryDialogProps {
  batch: {
    id: string;
    code: string;
    gender?: string;
    weightTier?: string;
    inPoolCount: number;
    outPoolCount: number;
    lossCount: number;
    isException: boolean;
    exceptionReason?: string | null;
    farmer: { name: string; code: string };
    pool?: { name: string; code: string } | null;
    items?: Array<{
      id: string;
      gender: string;
      weightTier: string;
      weight?: number;
      inPoolCount: number;
      outPoolCount: number;
      lossCount: number;
      pool: { name: string; code: string };
    }>;
    lossRecords?: Array<{
      id: string;
      inventoryDate: Date | string;
      bookInPool: number;
      physicalCount: number;
      lossCount: number;
      cumulativeLoss: number;
      lossRate: number;
      reason: string;
      inspector?: { fullName: string } | null;
    }>;
    bundleBatches?: Array<{
      id: string;
      code: string;
      createdAt: Date | string;
      doneAt?: Date | string | null;
      status: string;
      inputCount: number;
      qualifiedCount: number;
      lossCount: number;
      lossRate: number;
      lossReason?: string | null;
      group?: { name: string; code: string } | null;
      lines?: Array<{
        id: string;
        gender: string;
        weightTier: string;
        count: number;
        qualifiedCount?: number | null;
        lossCount?: number | null;
        pool?: { name: string; code: string } | null;
      }>;
      sortTasks?: Array<{
        id: string;
        code: string;
        gender: string;
        weightTier: string;
        inputCount: number;
        qualifiedCount: number;
        lossCount: number;
        lossRate: number;
        status: string;
        doneAt?: Date | string | null;
        createdAt: Date | string;
        machine?: { name: string; code: string } | null;
        coldLogs?: Array<{
          id: string;
          code: string;
          store?: { name: string; code: string } | null;
          outboundLosses?: Array<{
            id: string;
            gender: string;
            weightTier: string;
            count: number;
            reason: string;
            createdAt: Date | string;
            operator?: { fullName: string } | null;
          }>;
        }>;
      }>;
    }>;
  };
  trigger?: React.ReactNode;
}

export function BatchLossHistoryDialog({ batch, trigger }: BatchLossHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const stageLoss = Invariants.calculateBatchLifecycleLoss(batch);
  const liveInPool = Math.max(0, batch.inPoolCount - batch.outPoolCount - (batch.lossCount || 0));
  const hasItems = !!(batch.items && batch.items.length > 0);

  // 汇聚全流程损耗时间线
  const timeline: Array<{
    id: string;
    stage: string;
    stageIcon: "holding" | "bundling" | "sorting" | "cold";
    date: Date | string;
    operator: string;
    target: string;
    change: string;
    lossCount: number;
    reason: string;
  }> = [];

  // 1. 暂养池死蟹/损耗盘点
  for (const r of batch.lossRecords || []) {
    timeline.push({
      id: `holding-${r.id}`,
      stage: "暂养盘点",
      stageIcon: "holding",
      date: r.inventoryDate,
      operator: r.inspector?.fullName || "盘点员",
      target: hasItems ? "暂养池在池存量" : `${batch.pool?.name || "暂养池"}`,
      change: `${r.bookInPool.toLocaleString()} → ${r.physicalCount.toLocaleString()} 只`,
      lossCount: r.lossCount,
      reason: r.reason || "暂养期死蟹/自然损耗",
    });
  }

  // 2. 加工与流转环节损耗 (捆扎 / 分拣 / 冷库发货)
  for (const bb of batch.bundleBatches || []) {
    if (bb.lossCount > 0) {
      timeline.push({
        id: `bundle-${bb.id}`,
        stage: "捆扎加工",
        stageIcon: "bundling",
        date: bb.doneAt || bb.createdAt,
        operator: bb.group?.name || "捆扎班组",
        target: `捆扎批次 ${bb.code}`,
        change: `投入 ${bb.inputCount.toLocaleString()} ➔ 合格 ${bb.qualifiedCount.toLocaleString()} 只`,
        lossCount: bb.lossCount,
        reason: bb.lossReason || "捆扎掉爪、死蟹与残蟹损耗",
      });
    }

    for (const st of bb.sortTasks || []) {
      if (st.lossCount > 0) {
        timeline.push({
          id: `sort-${st.id}`,
          stage: "分拣称重",
          stageIcon: "sorting",
          date: st.doneAt || st.createdAt,
          operator: st.machine?.name || "分拣机",
          target: `${st.code} · ${st.gender === "FEMALE" ? "母蟹" : "公蟹"} ${st.weightTier}`,
          change: `投入 ${st.inputCount.toLocaleString()} ➔ 合格 ${st.qualifiedCount.toLocaleString()} 只`,
          lossCount: st.lossCount,
          reason: "规格称重分选剔除与损耗",
        });
      }

      for (const cl of st.coldLogs || []) {
        for (const ol of cl.outboundLosses || []) {
          if (ol.count > 0) {
            timeline.push({
              id: `cold-${ol.id}`,
              stage: "冷库发货",
              stageIcon: "cold",
              date: ol.createdAt,
              operator: ol.operator?.fullName || "冷库仓管",
              target: `${cl.code} · ${ol.gender === "FEMALE" ? "母蟹" : "公蟹"} ${ol.weightTier}`,
              change: `发货前实盘核减`,
              lossCount: ol.count,
              reason: ol.reason || "保鲜暂存及发货前残损盘点",
            });
          }
        }
      }
    }
  }

  // 按发生时间倒序排列
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <button
            type="button"
            className={`inline-flex items-center gap-1 font-mono font-medium hover:underline cursor-pointer transition-colors text-left ${
              stageLoss.isLossOverLimit ? "text-destructive font-bold" : "text-muted-foreground hover:text-foreground"
            }`}
            title="点击查看全环节损耗记录"
          >
            <span>
              {stageLoss.totalLoss.toLocaleString()} 只 ({stageLoss.totalLossRate.toFixed(1)}%)
            </span>
            {stageLoss.isLossOverLimit && <AlertTriangle className="size-3.5 text-destructive shrink-0" />}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            <DialogTitle className="text-base font-semibold">全环节损耗台账 · {batch.code}</DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <Badge variant="outline" className="text-xs font-normal">
                {batch.farmer.name} ({batch.farmer.code})
              </Badge>
              {hasItems ? (
                <Badge variant="outline" className="text-xs font-normal bg-primary/5 text-primary border-primary/20">
                  <Layers className="size-3 mr-1" />
                  共 {batch.items!.length} 档入库规格
                </Badge>
              ) : (
                <>
                  <Badge variant="outline" className="text-xs font-normal">
                    {batch.pool?.name || "暂养池"} ({batch.pool?.code || "—"})
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {batch.gender === "MALE" ? "公蟹" : "母蟹"} · {batch.weightTier || "4.0两"}
                  </Badge>
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          {/* 核心指标概览 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
            <div>
              <span className="text-[11px] text-muted-foreground">累计入池</span>
              <p className="font-mono font-medium">{batch.inPoolCount.toLocaleString()} 只</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">已出库 / 起池</span>
              <p className="font-mono font-medium">{batch.outPoolCount.toLocaleString()} 只</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">在池存活</span>
              <p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{liveInPool.toLocaleString()} 只</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">全环节总损耗 (总损耗率)</span>
              <p className={`font-mono font-semibold ${stageLoss.isLossOverLimit ? "text-destructive" : "text-foreground"}`}>
                {stageLoss.totalLoss.toLocaleString()} 只 ({stageLoss.totalLossRate.toFixed(1)}%)
              </p>
            </div>
          </div>

          {/* 各环节损耗流转分布栏 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
              <Package className="size-3.5 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground block truncate">暂养池损耗</span>
                <span className="font-mono font-semibold">{stageLoss.holdingLoss.toLocaleString()} 只</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
              <Scissors className="size-3.5 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground block truncate">捆扎加工损耗</span>
                <span className="font-mono font-semibold">{stageLoss.bundlingLoss.toLocaleString()} 只</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
              <Scale className="size-3.5 text-indigo-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground block truncate">机器分拣损耗</span>
                <span className="font-mono font-semibold">{stageLoss.sortingLoss.toLocaleString()} 只</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
              <Snowflake className="size-3.5 text-cyan-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground block truncate">冷库发货损耗</span>
                <span className="font-mono font-semibold">{stageLoss.coldLoss.toLocaleString()} 只</span>
              </div>
            </div>
          </div>

          {/* 5% 超标红线提示 */}
          {stageLoss.isLossOverLimit && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">【品控红线预警】：</span>
                全环节累计损耗率已达 <span className="font-bold font-mono">{stageLoss.totalLossRate.toFixed(1)}%</span>（超过 5% 阈值）。
                {batch.exceptionReason && (
                  <span className="ml-1 text-foreground/80">说明：{batch.exceptionReason}</span>
                )}
              </div>
            </div>
          )}

          {/* 批次多规格明细与在池损耗情况（解决入了4个规格只看到1个规格的问题） */}
          {hasItems && (
            <div className="rounded-md border overflow-hidden">
              <div className="bg-muted/50 px-3 py-1.5 text-xs font-semibold flex items-center justify-between border-b">
                <span>入库规格明细与暂养在池状态</span>
                <span className="text-muted-foreground font-normal text-[11px]">共 {batch.items!.length} 档规格</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-muted/20">
                    <TableHead className="py-1.5">入池仓位</TableHead>
                    <TableHead className="py-1.5">规格档位</TableHead>
                    <TableHead className="py-1.5 font-mono">入库数量</TableHead>
                    <TableHead className="py-1.5 font-mono">已起池/出库</TableHead>
                    <TableHead className="py-1.5 font-mono">账面在池</TableHead>
                    <TableHead className="py-1.5 font-mono text-destructive">暂养损耗</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.items!.map((it) => {
                    const itemLive = Math.max(0, it.inPoolCount - it.outPoolCount - (it.lossCount || 0));
                    return (
                      <TableRow key={it.id} className="text-xs">
                        <TableCell className="py-1.5 font-medium">
                          {it.pool.name}
                          <span className="text-muted-foreground font-mono ml-1 text-[11px]">({it.pool.code})</span>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <span className="font-semibold text-foreground">
                            {it.gender === "FEMALE" ? "母蟹" : "公蟹"}
                          </span>{" "}
                          <span className="text-muted-foreground font-mono">{it.weightTier}</span>
                        </TableCell>
                        <TableCell className="py-1.5 font-mono font-medium">{it.inPoolCount.toLocaleString()} 只</TableCell>
                        <TableCell className="py-1.5 font-mono text-muted-foreground">{it.outPoolCount.toLocaleString()} 只</TableCell>
                        <TableCell className="py-1.5 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {itemLive.toLocaleString()} 只
                        </TableCell>
                        <TableCell className="py-1.5 font-mono text-destructive">
                          {it.lossCount > 0 ? `-${it.lossCount.toLocaleString()} 只` : "0 只"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* 全环节损耗明细流转履历 */}
          <div className="rounded-md border overflow-hidden">
            <div className="bg-muted/50 px-3 py-1.5 text-xs font-semibold flex items-center justify-between border-b">
              <span>全环节损耗明细流转履历</span>
              <span className="text-muted-foreground font-normal text-[11px]">共 {timeline.length} 笔损耗事件</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="text-xs bg-muted/20">
                  <TableHead className="w-[130px] py-1.5">环节 / 时间</TableHead>
                  <TableHead className="w-[120px] py-1.5">业务对象 / 经手</TableHead>
                  <TableHead className="w-[170px] py-1.5">流转数据</TableHead>
                  <TableHead className="w-[90px] py-1.5">本次损耗</TableHead>
                  <TableHead className="py-1.5">损耗原因说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeline.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                      暂无损耗记录（该批次全流程尚未发生任何损耗）
                    </TableCell>
                  </TableRow>
                ) : (
                  timeline.map((r) => (
                    <TableRow key={r.id} className="text-xs">
                      <TableCell className="py-2">
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            variant={
                              r.stageIcon === "holding"
                                ? "secondary"
                                : r.stageIcon === "bundling"
                                ? "outline"
                                : "default"
                            }
                            className="w-fit text-[10px] px-1.5 py-0"
                          >
                            {r.stage}
                          </Badge>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {formatDateTime(r.date)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground truncate max-w-[120px]" title={r.target}>
                            {r.target}
                          </span>
                          <span className="text-[11px] text-muted-foreground">{r.operator}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 font-mono text-muted-foreground text-[11px]">
                        {r.change}
                      </TableCell>
                      <TableCell className="py-2 font-mono font-bold text-destructive">
                        -{r.lossCount.toLocaleString()} 只
                      </TableCell>
                      <TableCell className="py-2 text-muted-foreground leading-snug text-xs">
                        {r.reason}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
