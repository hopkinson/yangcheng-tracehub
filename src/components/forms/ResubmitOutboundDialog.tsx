"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { resubmitOutboundOrderAction } from "@/actions/outbound";
import { resubmitOutboundFormSchema, type ResubmitOutboundFormValues } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

export function ResubmitOutboundDialog({
  order,
  stores,
  userId,
}: {
  order: {
    id: string;
    code: string;
    outboundCount: number;
    storeId: string;
    rejectReason?: string | null;
    batch: { code: string; inPoolCount: number; outPoolCount: number; lossCount: number };
  };
  stores: Array<{ id: string; name: string; code: string; channel: { name: string } }>;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const liveInBatch = order.batch.inPoolCount - order.batch.outPoolCount - order.batch.lossCount;

  const form = useForm<ResubmitOutboundFormValues>({
    resolver: zodResolver(resubmitOutboundFormSchema),
    defaultValues: {
      storeId: order.storeId,
      outboundCount: order.outboundCount,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        storeId: order.storeId,
        outboundCount: order.outboundCount,
      });
    }
  }, [open, order.storeId, order.outboundCount, form]);

  async function onSubmit(data: ResubmitOutboundFormValues) {
    const count = Number(data.outboundCount);
    if (count > liveInBatch) {
      form.setError("outboundCount", {
        message: `在池存活不足: 当前批次仅剩 ${liveInBatch} 只`,
      });
      return;
    }

    setLoading(true);
    try {
      await resubmitOutboundOrderAction({
        orderId: order.id,
        storeId: data.storeId,
        outboundCount: count,
        applicantId: userId,
      });
      toast.success("出库申请已重新提交，请等待品控审批！");
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "重新提交失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-primary">
          <RefreshCw className="size-3" />
          修改重提
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改并重新提报出库单 ({order.code})</DialogTitle>
          <DialogDescription>
            关联批次：{order.batch.code} (当前在池存活 {liveInBatch} 只)
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            {order.rejectReason && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                <span className="font-semibold">此前品控驳回原因：</span> {order.rejectReason}
              </div>
            )}

            <FormField
              control={form.control}
              name="storeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>目标销售门店</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择目标门店" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.channel.name})
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
              name="outboundCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>修正出库数量 (只)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max={liveInBatch || undefined} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "提交中..." : "重新提报"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
