"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { registerLossAction } from "@/actions/batches";
import { lossRegisterFormSchema, type LossRegisterFormValues } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { AlertTriangle, ClipboardList } from "lucide-react";

export function LossRegisterDialog({
  batch,
  userId,
  trigger,
}: {
  batch: {
    id: string;
    code: string;
    inPoolCount: number;
    outPoolCount: number;
    lossCount: number;
  };
  userId: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const bookInPool = batch.inPoolCount - batch.outPoolCount - batch.lossCount;

  const form = useForm<LossRegisterFormValues>({
    resolver: zodResolver(lossRegisterFormSchema),
    defaultValues: {
      physicalCount: bookInPool,
      reason: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        physicalCount: bookInPool,
        reason: "",
      });
    }
  }, [open, bookInPool, form]);

  const watchedPhysical = form.watch("physicalCount");
  const numPhysical = typeof watchedPhysical === "number" ? watchedPhysical : parseInt(watchedPhysical, 10) || 0;
  const currentDelta = bookInPool - numPhysical;
  const projectedLoss = batch.lossCount + Math.max(0, currentDelta);
  const projectedLossRate = batch.inPoolCount > 0 ? ((projectedLoss / batch.inPoolCount) * 100).toFixed(2) : "0";
  const isHighLoss = Number(projectedLossRate) > 5.0;

  async function onSubmit(data: LossRegisterFormValues) {
    const physical = Number(data.physicalCount);
    if (physical > bookInPool) {
      form.setError("physicalCount", {
        message: "实盘数量大于账面在池，请核查盘点数量",
      });
      return;
    }

    if (isHighLoss && (!data.reason || !data.reason.trim())) {
      form.setError("reason", {
        message: "累计损耗率超 5%，请填写损耗原因",
      });
      return;
    }

    setLoading(true);
    try {
      await registerLossAction({
        batchId: batch.id,
        physicalCount: physical,
        reason: data.reason || "",
        inspectorId: userId,
      });

      toast.success("损耗盘点登记成功");
      setOpen(false);
      form.reset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "盘点登记失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="outline" size="sm">
            <ClipboardList className="size-3.5" data-icon="inline-start" />
            盘点损耗
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批次在池盘点与损耗登记</DialogTitle>
          <DialogDescription>
            批次号: <span className="font-mono font-medium text-foreground">{batch.code}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <div className="rounded-lg border bg-muted/30 p-3 text-xs flex flex-col gap-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">初始入池:</span>
                <span className="font-bold">{batch.inPoolCount} 只</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">已出库数:</span>
                <span>{batch.outPoolCount} 只</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">历史已登记损耗:</span>
                <span>{batch.lossCount} 只</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold text-primary">
                <span>当前账面在池:</span>
                <span>{bookInPool} 只</span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="physicalCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>现场实盘点数 (只)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" max={bookInPool} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-md border p-3 text-xs flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">本次盘亏损耗:</span>
                <span className="font-bold font-mono">{currentDelta >= 0 ? currentDelta : "异常"} 只</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">累计损耗率:</span>
                <span className={isHighLoss ? "font-bold text-destructive font-mono" : "font-mono"}>
                  {projectedLossRate}% {isHighLoss ? "(超5%阈值)" : ""}
                </span>
              </div>
            </div>

            {isHighLoss && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>
                  <strong>损耗超标提醒</strong>：累计损耗率已超过 5%，请填写损耗原因。
                </span>
              </div>
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>损耗原因说明 {isHighLoss && <span className="text-destructive">*</span>}</FormLabel>
                  <FormControl>
                    <Textarea placeholder="请输入损耗产生原因（脱水、残损、换壳损耗等）" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "提交中..." : "确认登记"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
