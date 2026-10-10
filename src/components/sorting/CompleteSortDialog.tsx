"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { sortCompletionTimeSchema } from "@/lib/validations/schemas";
import { formatDateTime } from "@/lib/utils";
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
  const timeForm = useForm<{ doneAt: string }>({
    resolver: zodResolver(sortCompletionTimeSchema),
    defaultValues: { doneAt: "" },
  });
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [qualifiedCount, setQualifiedCount] = useState<number>(inputCount);

  // 动态计算损耗
  const lossRes = Invariants.calculateSortingLoss({
    inputCount,
    qualifiedCount: qualifiedCount || 0,
  });

  const handleSubmit = ({ doneAt }: { doneAt: string }) => {
    if (qualifiedCount <= 0 || qualifiedCount > inputCount) {
      toast.error("合格只数必须大于 0 且不超过投入数量");
      return;
    }

    startTransition(async () => {
      const res = await completeSortTaskAction(taskId, qualifiedCount, doneAt);
      if (res.success) {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) timeForm.reset({ doneAt: formatDateTime(new Date()).replace(" ", "T") });
      setOpen(nextOpen);
    }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-6 px-2.5 text-[11px] gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
        >
          <CheckCircle2 className="size-3" />
          确认分拣结果
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="size-5 text-primary" />
            确认分拣合格数量与损耗结算
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            任务号：{code} · 规格：{gender === "FEMALE" ? "母蟹" : "公蟹"} {spec}
          </DialogDescription>
        </DialogHeader>

        <Form {...timeForm}>
          <form onSubmit={timeForm.handleSubmit(handleSubmit)} className="flex flex-col gap-4 py-1">
            <FormField
              control={timeForm.control}
              name="doneAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>分拣完成时间（北京时间）</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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

            <div className="flex flex-col gap-1.5">
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
            <div className="p-3 rounded-lg border text-xs flex flex-col gap-1 bg-muted/20">
              <div className="flex items-center justify-between font-mono">
                <span className="text-muted-foreground">机器分拣损耗：</span>
                <span className="font-bold text-foreground">{lossRes.lossCount} 只</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-muted-foreground">本次分拣损耗率：</span>
                <span
                  className={`font-bold text-sm ${
                    lossRes.isException ? "text-destructive" : "text-primary"
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
                className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                确认入库并完成分拣 ({qualifiedCount} 只)
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
