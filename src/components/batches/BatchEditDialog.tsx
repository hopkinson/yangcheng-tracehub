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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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

  const watchedItems = form.watch("items") || [];
  const totalWeight = watchedItems.reduce((sum, it) => sum + (Number(it?.weight) || 0), 0);
  const totalCount = watchedItems.reduce((sum, it) => sum + (Number(it?.inPoolCount) || 0), 0);

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
                  <FormControl><Input className="h-8 font-mono text-xs" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="escort" render={({ field }) => (
                <FormItem>
                  <FormLabel>跟车押运员</FormLabel>
                  <FormControl><Input className="h-8 text-xs" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="temp" render={({ field }) => (
                <FormItem>
                  <FormLabel>车内温度（℃）</FormLabel>
                  <FormControl><Input type="number" step="0.1" className="h-8 font-mono text-xs" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="humidity" render={({ field }) => (
                <FormItem>
                  <FormLabel>车内湿度（%）</FormLabel>
                  <FormControl><Input type="number" step="0.1" className="h-8 font-mono text-xs" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  入池规格与暂养明细（共 {sourceItems.length} 项）
                </span>
                <span className="text-[11px] text-muted-foreground">
                  暂养池与规格属于追溯核心，不可在此修改
                </span>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground border-b font-mono text-[11px]">
                    <tr>
                      <th className="px-3 py-2 font-medium">暂养仓位 · 规格档位</th>
                      <th className="px-3 py-2 font-medium text-right w-[110px]">重量（斤）</th>
                      <th className="px-3 py-2 font-medium text-right w-[110px]">入池数量（只）</th>
                      <th className="px-3 py-2 font-medium text-left w-[180px]">流转约束 / 说明</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {sourceItems.map((item: any, index: number) => {
                      const flowedCount = (item.outPoolCount || 0) + (item.lossCount || 0);
                      const isLegacy = !batch.items?.length;
                      const isFemale = item.gender === "FEMALE";

                      return (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 align-middle">
                            <div className="font-mono font-bold text-foreground text-xs">
                              {item.pool?.code || batch.pool?.code || "—"}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              <span className={isFemale ? "text-rose-600 dark:text-rose-400 font-medium" : "text-sky-600 dark:text-sky-400 font-medium"}>
                                {isFemale ? "母蟹" : "公蟹"}
                              </span>{" "}
                              <span className="font-mono">{item.weightTier || batch.weightTier || ""}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top">
                            <FormField
                              control={form.control}
                              name={`items.${index}.weight`}
                              render={({ field }) => (
                                <FormItem className="space-y-0.5">
                                  <FormLabel className="sr-only">重量（斤）</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={isLegacy ? "0" : "0.1"}
                                      step="0.1"
                                      disabled={isLegacy}
                                      className="h-8 text-xs font-mono text-right w-full"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-[11px]" />
                                </FormItem>
                              )}
                            />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <FormField
                              control={form.control}
                              name={`items.${index}.inPoolCount`}
                              render={({ field }) => (
                                <FormItem className="space-y-0.5">
                                  <FormLabel className="sr-only">入池数量（只）</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={Math.max(1, flowedCount)}
                                      step="1"
                                      className="h-8 text-xs font-mono text-right font-bold w-full"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-[11px]" />
                                </FormItem>
                              )}
                            />
                          </td>
                          <td className="px-3 py-2 align-middle text-[11px]">
                            {isLegacy ? (
                              <span className="text-muted-foreground">旧版单规格批次未记录重量</span>
                            ) : flowedCount > 0 ? (
                              <span className="text-amber-600 dark:text-amber-400 font-mono">
                                已流转 {flowedCount} 只（不可低于此数）
                              </span>
                            ) : (
                              <span className="text-muted-foreground">该明细尚未影响下游</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t font-mono text-xs">
                    <tr>
                      <td className="px-3 py-2 font-medium text-muted-foreground">合计</td>
                      <td className="px-3 py-2 text-right font-bold text-foreground">
                        {totalWeight.toFixed(1)} 斤
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-primary">
                        {totalCount} 只
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-[11px]">
                        共 {sourceItems.length} 档规格
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
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
