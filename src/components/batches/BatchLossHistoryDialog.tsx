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
import { AlertTriangle, History } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export interface BatchLossHistoryDialogProps {
  batch: {
    id: string;
    code: string;
    gender: string;
    weightTier: string;
    inPoolCount: number;
    outPoolCount: number;
    lossCount: number;
    isException: boolean;
    exceptionReason?: string | null;
    farmer: { name: string; code: string };
    pool: { name: string; code: string };
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
  };
  trigger?: React.ReactNode;
}

export function BatchLossHistoryDialog({ batch, trigger }: BatchLossHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const liveInPool = batch.inPoolCount - batch.outPoolCount - batch.lossCount;
  const lossRate = batch.inPoolCount > 0 ? (batch.lossCount / batch.inPoolCount) * 100 : 0;
  const isLossOverLimit = lossRate > 5;
  const records = batch.lossRecords || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <button
            type="button"
            className={`inline-flex items-center gap-1 font-mono font-medium hover:underline cursor-pointer transition-colors text-left ${
              isLossOverLimit ? "text-destructive font-bold" : "text-muted-foreground hover:text-foreground"
            }`}
            title="点击查看历次盘点损耗记录"
          >
            <span>
              {batch.lossCount.toLocaleString()} 只 ({lossRate.toFixed(1)}%)
            </span>
            {isLossOverLimit && <AlertTriangle className="size-3.5 text-destructive shrink-0" />}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            <DialogTitle className="text-base font-semibold">盘点损耗履历 · {batch.code}</DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <Badge variant="outline" className="text-xs font-normal">
                {batch.farmer.name} ({batch.farmer.code})
              </Badge>
              <Badge variant="outline" className="text-xs font-normal">
                {batch.pool.name} ({batch.pool.code})
              </Badge>
              <Badge variant="secondary" className="text-xs font-normal">
                {batch.gender === "MALE" ? "公蟹" : "母蟹"} · {batch.weightTier}
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          {/* 轻量指标概览栏 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
            <div>
              <span className="text-[11px] text-muted-foreground">累计入池</span>
              <p className="font-mono font-medium">{batch.inPoolCount.toLocaleString()} 只</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">已出库</span>
              <p className="font-mono font-medium">{batch.outPoolCount.toLocaleString()} 只</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">在池存活</span>
              <p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{liveInPool.toLocaleString()} 只</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">累计损耗 (率)</span>
              <p className={`font-mono font-semibold ${isLossOverLimit ? "text-destructive" : "text-foreground"}`}>
                {batch.lossCount.toLocaleString()} 只 ({lossRate.toFixed(1)}%)
              </p>
            </div>
          </div>

          {/* 5% 超标红线提示 */}
          {isLossOverLimit && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">【品控红线预警】：</span>
                累计损耗率已达 <span className="font-bold font-mono">{lossRate.toFixed(1)}%</span>（超过 5% 阈值）。
                {batch.exceptionReason && (
                  <span className="ml-1 text-foreground/80">原因：{batch.exceptionReason}</span>
                )}
              </div>
            </div>
          )}

          {/* 精简 4 列履历表格 */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-[140px]">盘点时间 / 盘点人</TableHead>
                  <TableHead className="w-[150px]">在池变动 (实盘)</TableHead>
                  <TableHead className="w-[100px]">本次损耗</TableHead>
                  <TableHead>损耗原因</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                      暂无盘点损耗记录（该批次尚未发生损耗盘点）
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((r) => (
                    <TableRow key={r.id} className="text-xs">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-muted-foreground">
                            {formatDateTime(r.inventoryDate)}
                          </span>
                          <span className="text-[11px] text-muted-foreground/80">
                            {r.inspector?.fullName || "仓库盘点员"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        <span className="text-muted-foreground">{r.bookInPool.toLocaleString()}</span>
                        <span className="mx-1 text-muted-foreground/60">→</span>
                        <span className="font-medium text-foreground">{r.physicalCount.toLocaleString()} 只</span>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-destructive">
                        -{r.lossCount.toLocaleString()} 只
                      </TableCell>
                      <TableCell className="text-muted-foreground leading-snug">
                        {r.reason || "常规盘点自然损耗"}
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
