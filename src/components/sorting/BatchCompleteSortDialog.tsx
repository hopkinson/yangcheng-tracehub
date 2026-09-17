"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { batchCompleteSortTasksAction } from "@/actions/production";
import { Invariants } from "@/lib/invariants";

export interface BatchSortTaskItem {
  id: string;
  code: string;
  gender: string;
  weightTier: string;
  inputCount: number;
}

export function BatchCompleteSortDialog({
  batchCode,
  machineName,
  sourceBatchCode,
  tasks,
}: {
  batchCode: string;
  machineName: string;
  sourceBatchCode: string;
  tasks: BatchSortTaskItem[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [qualifiedCounts, setQualifiedCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(tasks.map((t) => [t.id, t.inputCount]))
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setQualifiedCounts(Object.fromEntries(tasks.map((t) => [t.id, t.inputCount])));
    setOpen(nextOpen);
  };

  const handleCountChange = (taskId: string, maxCount: number, val: number) => {
    setQualifiedCounts((prev) => ({
      ...prev,
      [taskId]: Math.max(0, Math.min(maxCount, val || 0)),
    }));
  };

  const totalInput = tasks.reduce((sum, t) => sum + t.inputCount, 0);
  const totalQualified = tasks.reduce((sum, t) => sum + (qualifiedCounts[t.id] ?? t.inputCount), 0);
  const totalLoss = Math.max(0, totalInput - totalQualified);
  const overallLossRate = totalInput > 0 ? Number(((totalLoss / totalInput) * 100).toFixed(2)) : 0;
  const isOverallHighLoss = overallLossRate > 5.0;

  let hasOverLimitLoss = false;
  const rows = tasks.map((task) => {
    const qualified = qualifiedCounts[task.id] ?? task.inputCount;
    const lossRes = Invariants.calculateSortingLoss({ inputCount: task.inputCount, qualifiedCount: qualified });
    if (lossRes.isException) hasOverLimitLoss = true;
    return { task, qualified, lossCount: lossRes.lossCount, lossRate: lossRes.lossRate, isException: lossRes.isException };
  });


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const invalid = tasks.find((t) => {
      const q = qualifiedCounts[t.id];
      return q == null || q <= 0 || q > t.inputCount;
    });

    if (invalid) {
      toast.error(
        `规格 ${invalid.gender === "FEMALE" ? "母" : "公"}${invalid.weightTier} 的合格数必须大于 0 且不超过投入数`
      );
      return;
    }

    startTransition(async () => {
      const items = tasks.map((t) => ({
        taskId: t.id,
        qualifiedCount: qualifiedCounts[t.id],
      }));

      const res = await batchCompleteSortTasksAction(items);
      if (res.success) {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
        >
          <CheckCircle2 className="size-3.5" />
          批量确认结果
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="size-5 text-emerald-600" />
            批量确认分拣合格数量与损耗结算
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            分拣批次：{batchCode} · 作业设备：{machineName} · 原料批次：{sourceBatchCode}（共 {tasks.length} 笔规格待分拣）
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto px-1">
          {/* 明细表格 */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b font-mono text-[11px]">
                <tr>
                  <th className="px-3 py-2 font-medium">任务号 / 规格</th>
                  <th className="px-3 py-2 font-medium text-right w-[90px]">投入 (只)</th>
                  <th className="px-3 py-2 font-medium text-right w-[130px]">合格只数 (入库)</th>
                  <th className="px-3 py-2 font-medium text-right w-[90px]">结算损耗</th>
                  <th className="px-3 py-2 font-medium text-right w-[90px]">损耗率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map(({ task, qualified, lossCount, lossRate, isException }) => {
                  const isFemale = task.gender === "FEMALE";
                  return (
                    <tr key={task.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <div className="font-mono text-muted-foreground text-[11px]">{task.code}</div>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium mt-0.5 ${
                            isFemale
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                              : "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                          }`}
                        >
                          {isFemale ? "母" : "公"} {task.weightTier}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-foreground">
                        {task.inputCount}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          min={1}
                          max={task.inputCount}
                          value={qualified || ""}
                          onChange={(e) =>
                            handleCountChange(task.id, task.inputCount, parseInt(e.target.value, 10))
                          }
                          className="h-8 text-xs font-mono text-right font-bold w-24 ml-auto"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {lossCount} 只
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span
                          className={
                            isException
                              ? "text-destructive font-semibold bg-destructive/10 px-1 py-0.5 rounded text-[11px]"
                              : "text-muted-foreground"
                          }
                        >
                          {lossRate}%{isException && " ⚠️"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 综合指标汇总 */}
          <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
              <div className="p-2 rounded bg-background border">
                <span className="text-[11px] text-muted-foreground block">整批总投入</span>
                <span className="text-sm font-bold text-foreground">{totalInput} 只</span>
              </div>
              <div className="p-2 rounded bg-background border">
                <span className="text-[11px] text-muted-foreground block">整批总合格</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {totalQualified} 只
                </span>
              </div>
              <div className="p-2 rounded bg-background border">
                <span className="text-[11px] text-muted-foreground block">整批总损耗</span>
                <span className="text-sm font-bold text-muted-foreground">{totalLoss} 只</span>
              </div>
              <div className="p-2 rounded bg-background border">
                <span className="text-[11px] text-muted-foreground block">综合损耗率</span>
                <span
                  className={`text-sm font-bold ${
                    isOverallHighLoss ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {overallLossRate}%
                </span>
              </div>
            </div>

            {(hasOverLimitLoss || isOverallHighLoss) && (
              <div className="text-[11px] text-destructive flex items-center gap-1.5 font-medium px-1">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>存在分拣损耗率超过 5% 警戒线的规格，系统将在完成结算后自动标注并进入监控告警。</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || totalQualified <= 0 || totalQualified > totalInput}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              确认整批入库 ({totalQualified} 只)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
