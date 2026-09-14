"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateBatchAction } from "@/actions/batches";
import { batchEditFormSchema, type BatchEditFormValues } from "@/lib/validations/schemas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

function getValues(batch: any): BatchEditFormValues {
  const items = batch.items?.length ? batch.items : [batch];
  return {
    formNo: batch.formNo || "",
    escort: batch.escort || "",
    temp: batch.temp ?? 0,
    humidity: batch.humidity ?? 0,
    items: items.map((item: any) => ({
      id: item.id,
      weight: item.weight ?? 0,
      inPoolCount: item.inPoolCount,
    })),
  };
}

export function BatchEditDialog({ batch, trigger }: { batch: any; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const sourceItems = batch.items?.length ? batch.items : [batch];
  const form = useForm<BatchEditFormValues>({
    resolver: zodResolver(batchEditFormSchema),
    defaultValues: getValues(batch),
  });
  const loading = form.formState.isSubmitting;

  useEffect(() => {
    if (open) form.reset(getValues(batch));
  }, [open, batch, form]);

  async function onSubmit(values: BatchEditFormValues) {
    try {
      const result = await updateBatchAction({ batchId: batch.id, ...values });
      if (!result.success) {
        toast.error(result.error || "更新批次失败");
        return;
      }
      toast.success(result.message);
      setOpen(false);
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "更新批次失败");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-primary" />
            编辑原料批次 {batch.code}
          </DialogTitle>
          <DialogDescription>
            可修正码单信息、重量和入池数量；养殖户、暂养池及规格属于追溯标识，不在此处修改。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField control={form.control} name="formNo" render={({ field }) => (
                <FormItem>
                  <FormLabel>纸质入库码单表号</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="escort" render={({ field }) => (
                <FormItem>
                  <FormLabel>跟车押运员</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="temp" render={({ field }) => (
                <FormItem>
                  <FormLabel>车内温度（℃）</FormLabel>
                  <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="humidity" render={({ field }) => (
                <FormItem>
                  <FormLabel>车内湿度（%）</FormLabel>
                  <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex flex-col gap-3 border rounded-lg p-3">
              {sourceItems.map((item: any, index: number) => {
                const flowedCount = (item.outPoolCount || 0) + (item.lossCount || 0);
                const isLegacy = !batch.items?.length;
                return (
                  <div key={item.id} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b last:border-0 pb-3 last:pb-0">
                    <div className="sm:col-span-2 text-sm font-medium">
                      {item.pool?.code || batch.pool?.code} · {item.gender === "FEMALE" ? "母蟹" : "公蟹"} {item.weightTier}
                    </div>
                    <FormField control={form.control} name={`items.${index}.weight`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>重量（斤）</FormLabel>
                        <FormControl><Input type="number" min={isLegacy ? "0" : "0.1"} step="0.1" disabled={isLegacy} {...field} /></FormControl>
                        {isLegacy && <FormDescription>旧版单规格批次未记录重量</FormDescription>}
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`items.${index}.inPoolCount`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>入池数量（只）</FormLabel>
                        <FormControl><Input type="number" min={Math.max(1, flowedCount)} step="1" {...field} /></FormControl>
                        <FormDescription>
                          {flowedCount > 0 ? `已绑扎/起池及损耗共 ${flowedCount} 只，修改后不能低于此数` : "该明细尚未影响下游"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>取消</Button>
              <Button type="submit" disabled={loading} className="gap-1.5">
                {loading && <Loader2 className="size-4 animate-spin" />}
                保存修改
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
