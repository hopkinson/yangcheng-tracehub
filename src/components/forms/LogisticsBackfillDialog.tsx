"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { updateLogisticsAction } from "@/actions/outbound";
import { logisticsFormSchema, type LogisticsFormValues } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { Truck } from "lucide-react";

export function LogisticsBackfillDialog({
  order,
  userId,
  userName,
}: {
  order: {
    id: string;
    code: string;
    logisticsNo: string | null;
  };
  userId: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const initialLogistics = order.logisticsNo === "待生成" ? "" : order.logisticsNo || "";

  const form = useForm<LogisticsFormValues>({
    resolver: zodResolver(logisticsFormSchema),
    defaultValues: {
      logisticsNo: initialLogistics,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        logisticsNo: order.logisticsNo === "待生成" ? "" : order.logisticsNo || "",
      });
    }
  }, [open, order.logisticsNo, form]);

  async function onSubmit(data: LogisticsFormValues) {
    setLoading(true);
    try {
      await updateLogisticsAction({
        orderId: order.id,
        logisticsNo: data.logisticsNo.trim(),
        operatorId: userId,
        operatorName: userName,
      });

      toast.success("物流单号回填成功！");
      setOpen(false);
      form.reset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "回填失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Truck className="size-3.5" data-icon="inline-start" />
          {order.logisticsNo && order.logisticsNo !== "待生成" ? "修改物流" : "回填物流"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>物流运单号回填与留痕</DialogTitle>
          <DialogDescription>
            出库单号: <span className="font-mono font-medium text-foreground">{order.code}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <FormField
              control={form.control}
              name="logisticsNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>快递/冷链物流单号 (如顺丰/京东)</FormLabel>
                  <FormControl>
                    <Input placeholder="如: SF10882391029" className="font-mono" {...field} />
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
                {loading ? "提交中..." : "确认回填"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
