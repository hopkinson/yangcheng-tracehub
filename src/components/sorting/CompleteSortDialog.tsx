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
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { completeSortTaskAction } from "@/actions/production";
import { Invariants } from "@/lib/invariants";

export function CompleteSortDialog({
  taskId,
  code,
  inputCount,
  spec,
  gender,
}: {
  taskId: string;
  code: string;
  inputCount: number;
  spec: string;
  gender: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [qualifiedCount, setQualifiedCount] = useState<number>(inputCount);

  // 动态计算损耗
  const lossRes = Invariants.calculateSortingLoss({
    inputCount,
    qualifiedCount: qualifiedCount || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (qualifiedCount <= 0 || qualifiedCount > inputCount) {
      toast.error("合格只数必须大于 0 且不超过投入数量");
      return;
    }

    startTransition(async () => {
      const res = await completeSortTaskAction(taskId, qualifiedCount);
      if (res.success) {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-6 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
        >
          <CheckCircle2 className="size-3" />
          确认分拣结果
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="size-5 text-emerald-600" />
            确认分拣合格数量与损耗结算
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            任务号：{code} · 规格：{gender === "FEMALE" ? "母蟹" : "公蟹"} {spec}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="p-3 rounded-lg border bg-muted/30 grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-[11px] text-muted-foreground block">本批投入分拣数</span>
              <span className="text-base font-bold text-foreground">{inputCount} 只</span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">分规标准档位</span>
              <span className="text-base font-bold text-primary">
                {gender === "FEMALE" ? "母蟹" : "公蟹"} {spec}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              符合标准合格只数 <span className="text-[11px] text-muted-foreground">（将计入冷库可出库存）</span>
            </Label>
            <Input
              type="number"
              min={1}
              max={inputCount}
              value={qualifiedCount || ""}
              onChange={(e) => setQualifiedCount(parseInt(e.target.value, 10) || 0)}
              className="h-9 text-sm font-mono text-right font-bold"
              autoFocus
            />
          </div>

          {/* 损耗率实时反馈 */}
          <div className="p-3 rounded-lg border text-xs space-y-1 bg-muted/20">
            <div className="flex items-center justify-between font-mono">
              <span className="text-muted-foreground">自动结算损耗只数：</span>
              <span className="font-bold text-foreground">{lossRes.lossCount} 只</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-muted-foreground">本次分拣损耗率：</span>
              <span
                className={`font-bold text-sm ${
                  lossRes.isException ? "text-destructive" : "text-emerald-600"
                }`}
              >
                {lossRes.lossRate}%
              </span>
            </div>

            {lossRes.isException && (
              <div className="pt-2 text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertTriangle className="size-3.5 shrink-0" />
                损耗率已超过 5% 警戒阈值，系统将自动记录并进入业务预警！
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
              disabled={isPending || qualifiedCount <= 0 || qualifiedCount > inputCount}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              确认入库并完成分拣 ({qualifiedCount} 只)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
