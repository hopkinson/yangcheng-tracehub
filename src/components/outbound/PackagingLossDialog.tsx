"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PackageMinus } from "lucide-react";
import { toast } from "sonner";
import { batchRegisterPackagingLossAction } from "@/actions/outbound";
import type { ColdLocationStock } from "@/lib/cold-stock";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  coldStoreId: z.string().min(1, "请选择包装作业所在库位"),
  losses: z.record(z.coerce.number().int().min(0)).default({}),
  reason: z.string().trim().max(200, "原因说明最多 200 字").default(""),
});

type FormValues = z.infer<typeof formSchema>;

const stockKey = (gender: string, weightTier: string) => `${gender}_${weightTier.replace(/\W/g, "_")}`;

export function PackagingLossDialog({ locations }: { locations: ColdLocationStock[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { coldStoreId: locations[0]?.storeId || "", losses: {}, reason: "" },
  });
  const selectedStoreId = form.watch("coldStoreId");
  const losses = form.watch("losses");
  const location = useMemo(
    () => locations.find((item) => item.storeId === selectedStoreId),
    [locations, selectedStoreId],
  );
  const selectedLosses = (location?.stocks || []).map((stock) => ({
    stock,
    count: Math.min(stock.available, Math.max(0, Math.floor(Number(losses?.[stockKey(stock.gender, stock.weightTier)]) || 0))),
  }));
  const affectedLosses = selectedLosses.filter((item) => item.count > 0);
  const totalLoss = affectedLosses.reduce((sum, item) => sum + item.count, 0);
  const totalQualified = affectedLosses.reduce((sum, item) => sum + item.stock.qualified, 0);
  const totalHistoricalLoss = affectedLosses.reduce((sum, item) => sum + item.stock.packagingLoss, 0);
  const lossRate = totalQualified > 0 ? ((totalHistoricalLoss + totalLoss) / totalQualified) * 100 : 0;
  const isAnyItemHighLoss = affectedLosses.some((item) => {
    const qualified = item.stock.qualified || 0;
    const historical = item.stock.packagingLoss || 0;
    return qualified > 0 && ((historical + item.count) / qualified) * 100 > 5;
  });
  const isHighLoss = lossRate > 5 || isAnyItemHighLoss;

  const onSubmit = (values: FormValues) => {
    const items = affectedLosses.map(({ stock, count }) => ({
      gender: stock.gender,
      weightTier: stock.weightTier,
      lossCount: count,
    }));
    if (items.length === 0) {
      toast.error("请至少填写一个规格的包装损耗数量");
      return;
    }
    if (isHighLoss && !values.reason.trim()) {
      form.setError("reason", { message: "累计包装损耗率超过 5% 警戒线，请填写损耗原因说明" });
      return;
    }

    startTransition(async () => {
      try {
        const result = await batchRegisterPackagingLossAction({
          coldStoreId: values.coldStoreId,
          items,
          reason: values.reason,
        });
        if (!result.success) {
          toast.error(result.message || "包装损耗登记失败");
          return;
        }
        toast.success(`包装损耗已即时核销 ${result.totalLossRecorded} 只，无需审批`);
        form.reset({ coldStoreId: values.coldStoreId, losses: {}, reason: "" });
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "包装损耗登记失败");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={locations.length === 0}>
          <PackageMinus className="size-4" />
          登记包装损耗
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>登记包装损耗</DialogTitle>
          <DialogDescription>
            选择一个库位，可一次登记该库位多个规格的包装损耗。提交后直接从可用库存扣减并即时核销，不进入审批。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="coldStoreId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>包装作业库位</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("losses", {});
                    }}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="请选择库位" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locations.map((item) => (
                        <SelectItem key={item.storeId} value={item.storeId}>
                          {item.storeName} ({item.storeCode}) · 可用 {item.totalAvailable} 只
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border divide-y">
              <div className="grid grid-cols-[1fr_100px_130px] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                <span>规格</span><span className="text-right">当前可用</span><span>包装损耗</span>
              </div>
              {location?.stocks.map((stock) => {
                const key = stockKey(stock.gender, stock.weightTier);
                return (
                  <div key={key} className="grid grid-cols-[1fr_100px_130px] gap-3 items-center px-3 py-2.5">
                    <span className="text-sm font-medium">{stock.label}</span>
                    <span className="text-right font-mono text-sm">{stock.available.toLocaleString()} 只</span>
                    <FormField
                      control={form.control}
                      name={`losses.${key}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">{stock.label} 包装损耗</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={0}
                              max={stock.available}
                              step={1}
                              value={field.value ?? ""}
                              placeholder="0"
                              className="h-8 font-mono"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
              <div><span className="text-muted-foreground">本次包装损耗：</span><strong>{totalLoss} 只</strong></div>
              <div><span className="text-muted-foreground">累计包装损耗率：</span><strong className={isHighLoss ? "text-destructive" : "text-foreground"}>{lossRate.toFixed(2)}%</strong></div>
            </div>

            {isHighLoss && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-1.5">
                <span>⚠️ 累计包装损耗率已超 5% 预警红线，必须在下方填写损耗原因说明后方可提交登记。</span>
              </div>
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    损耗原因说明 {isHighLoss ? <span className="text-destructive font-semibold">* (超 5% 必填)</span> : <span className="text-xs text-muted-foreground font-normal">(选填)</span>}
                  </FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="如装箱挑残、包装破损等（超 5% 时必填）" rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
              <Button type="submit" disabled={isPending || totalLoss <= 0}>
                {isPending ? "登记中..." : `确认核销 ${totalLoss} 只`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
