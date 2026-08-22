"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { createOutboundOrderAction } from "@/actions/outbound";
import { outboundOrderFormSchema, type OutboundOrderFormValues } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { Plus, Truck } from "lucide-react";

export function OutboundOrderDialog({
  batches,
  stores,
  userId,
}: {
  batches: Array<{
    id: string;
    code: string;
    gender: string;
    weightTier: string;
    farmer: { name: string };
    pool: { code: string };
    liveInPool: number;
  }>;
  stores: Array<{
    id: string;
    code: string;
    name: string;
    channel: { name: string };
  }>;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<OutboundOrderFormValues>({
    resolver: zodResolver(outboundOrderFormSchema),
    defaultValues: {
      batchId: batches[0]?.id || "",
      storeId: stores[0]?.id || "",
      outboundCount: 500,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        batchId: batches[0]?.id || "",
        storeId: stores[0]?.id || "",
        outboundCount: 500,
      });
    }
  }, [open, batches, stores, form]);

  const selectedBatchId = form.watch("batchId");
  const currentBatch = batches.find((b) => b.id === selectedBatchId);
  const maxAvailable = currentBatch ? currentBatch.liveInPool : 0;

  async function onSubmit(data: OutboundOrderFormValues) {
    const count = Number(data.outboundCount);
    if (count > maxAvailable) {
      form.setError("outboundCount", {
        message: `在池存活不足: 当前批次仅剩 ${maxAvailable} 只`,
      });
      return;
    }

    setLoading(true);
    try {
      await createOutboundOrderAction({
        batchId: data.batchId,
        storeId: data.storeId,
        outboundCount: count,
        applicantId: userId,
      });

      toast.success("出库申请已提交，等待审批");
      setOpen(false);
      form.reset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "申请失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="size-4" data-icon="inline-start" />
          出库发货申请
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            <DialogTitle>大闸蟹出库打包申请</DialogTitle>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <FormField
              control={form.control}
              name="batchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>选择出库原料批次</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择批次" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {batches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.code} ({b.farmer.name} · {b.gender === "MALE" ? "公" : "母"}{b.weightTier} · 存活:{b.liveInPool}只)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="storeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>目标销售门店 (从主档选择)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择门店" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          [{s.channel.name}] {s.name} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {currentBatch && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs flex flex-col gap-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">来源养殖户:</span>
                  <span>{currentBatch.farmer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">暂养池仓位:</span>
                  <span>{currentBatch.pool.code}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold text-emerald-600">
                  <span>该批次在池存活上限:</span>
                  <span className="text-sm">{maxAvailable.toLocaleString()} 只</span>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="outboundCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>出库发运数量 (只) - 自动同步单票订单数</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max={maxAvailable || undefined} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={loading || maxAvailable <= 0}>
                {loading ? "提交中..." : "确认提交出库单"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
