"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { createBatchAction } from "@/actions/batches";
import { uploadFileAction } from "@/actions/upload";
import { batchIntakeFormSchema, type BatchIntakeFormValues } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Waves, Upload, FileText, X } from "lucide-react";

export const WEIGHT_TIERS = [
  "2.0两",
  "2.5两",
  "3.0两",
  "3.5两",
  "4.0两",
  "4.5两",
  "5.0两",
  "5.5两",
  "6.0两",
  "6.5两",
  "7.0两",
  "7.5两",
  "8.0两",
] as const;

export function BatchIntakeDialog({
  farmers,
  pools,
  userId,
  isAdmin = false,
}: {
  farmers: Array<{
    id: string;
    name: string;
    code: string;
    quota?: number;
    batches?: Array<{ inPoolCount: number }>;
    enclosures: Array<{ id: string; code: string }>;
  }>;
  pools: Array<{ id: string; name: string; code: string; currentGender: string | null; currentWeightTier: string | null }>;
  userId: string;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const defaultFarmer = farmers[0];
  const defaultEnclosure = defaultFarmer?.enclosures[0]?.id || "";
  const defaultPool = pools[0]?.id || "";

  const form = useForm<BatchIntakeFormValues>({
    resolver: zodResolver(batchIntakeFormSchema),
    defaultValues: {
      farmerId: defaultFarmer?.id || "",
      enclosureId: defaultEnclosure,
      poolId: defaultPool,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolCount: 1000,
      reportName: "",
      reportUrl: "",
      allowSpecialApproval: false,
      specialReason: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        farmerId: farmers[0]?.id || "",
        enclosureId: farmers[0]?.enclosures[0]?.id || "",
        poolId: pools[0]?.id || "",
        gender: "MALE",
        weightTier: "4.0两",
        inPoolCount: 1000,
        reportName: "",
        reportUrl: "",
        allowSpecialApproval: false,
        specialReason: "",
      });
    }
  }, [open, farmers, pools, form]);

  const selectedFarmerId = form.watch("farmerId");
  const currentFarmer = farmers.find((f) => f.id === selectedFarmerId);
  const selectedGender = form.watch("gender");
  const selectedWeight = form.watch("weightTier");
  const reportName = form.watch("reportName");
  const watchedInPool = form.watch("inPoolCount");
  const numInPool = typeof watchedInPool === "number" ? watchedInPool : parseInt(watchedInPool, 10) || 0;

  const cumulativeInPool = currentFarmer?.batches?.reduce((sum, b) => sum + b.inPoolCount, 0) || 0;
  const farmerQuota = currentFarmer?.quota || 0;
  const remainingQuota = Math.max(0, farmerQuota - cumulativeInPool);
  const isOverQuota = farmerQuota > 0 && numInPool > remainingQuota;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("文件不能超过 10MB");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadFileAction(formData);
      form.setValue("reportUrl", res.url);
      form.setValue("reportName", res.name);
      toast.success(`报告已上传: ${res.name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "文件上传失败";
      toast.error(msg);
    }
  };

  async function onSubmit(data: BatchIntakeFormValues) {
    setLoading(true);
    try {
      await createBatchAction({
        farmerId: data.farmerId,
        enclosureId: data.enclosureId,
        poolId: data.poolId,
        gender: data.gender,
        weightTier: data.weightTier,
        inPoolCount: Number(data.inPoolCount),
        createdById: userId,
        reportUrl: data.reportUrl || undefined,
        reportName: data.reportName || undefined,
        allowSpecialApproval: data.allowSpecialApproval,
        specialReason: data.specialReason,
      });

      toast.success("批次入池登记成功");
      setOpen(false);
      form.reset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "入池失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="size-4" data-icon="inline-start" />
                创建批次
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>原料入池登记（入库即入池）</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Waves className="size-5 text-primary" />
            <DialogTitle>活蟹到厂入池登记</DialogTitle>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <FormField
              control={form.control}
              name="farmerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>来源养殖户</FormLabel>
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      const f = farmers.find((item) => item.id === val);
                      if (f && f.enclosures.length > 0) {
                        form.setValue("enclosureId", f.enclosures[0].id);
                      }
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择养殖户" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {farmers.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.code} - {f.name}
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
              name="enclosureId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>来源围网</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择围网" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currentFarmer?.enclosures.map((enc) => (
                        <SelectItem key={enc.id} value={enc.id}>
                          围网编号: {enc.code}
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
              name="poolId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>存放暂养池 (按规格复用)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择暂养池" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pools.map((p) => {
                        const isConflict = Boolean(
                          p.currentGender && (p.currentGender !== selectedGender || p.currentWeightTier !== selectedWeight)
                        );
                        return (
                          <SelectItem key={p.id} value={p.id} disabled={isConflict}>
                            {p.name || p.code}{" "}
                            {p.currentGender
                              ? `(在养: ${p.currentGender === "MALE" ? "公" : "母"} ${p.currentWeightTier}${isConflict ? " · 规格冲突不可选" : ""})`
                              : "(空池)"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>公母</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MALE">公蟹</SelectItem>
                        <SelectItem value="FEMALE">母蟹</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weightTier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>重量档位规格</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                      {WEIGHT_TIERS.map((tier) => (
                        <SelectItem key={tier} value={tier}>
                          {tier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="inPoolCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>本次入池数量 (只)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" placeholder="如: 1000" {...field} />
                  </FormControl>
                  {currentFarmer && farmerQuota > 0 && (
                    <div className="text-[11px] text-muted-foreground flex justify-between pt-0.5">
                      <span>当年已入池: {cumulativeInPool.toLocaleString()} 只</span>
                      <span>剩余额度: {remainingQuota.toLocaleString()} 只</span>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 超额特批放行 (仅管理员可见) */}
            {isOverQuota && isAdmin && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-2.5">
                <div className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                  超额提醒：本批入池数量超出剩余额度（超 {(numInPool - remainingQuota).toLocaleString()} 只）
                </div>
                <FormField
                  control={form.control}
                  name="allowSpecialApproval"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="size-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      </FormControl>
                      <FormLabel className="text-xs font-medium text-amber-900 dark:text-amber-200 cursor-pointer">
                        启用管理员特批放行入池
                      </FormLabel>
                    </FormItem>
                  )}
                />
                {form.watch("allowSpecialApproval") && (
                  <FormField
                    control={form.control}
                    name="specialReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="请填写特批放行原因（必填）" className="text-xs bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            {/* 监测报告上传 */}
            <div className="flex flex-col gap-1.5 border-t pt-3">
              <FormLabel className="flex items-center justify-between text-xs">
                <span>检测报告 (药残/产地证明) - 可选</span>
                <span className="text-[11px] text-muted-foreground">支持 PDF/JPG/PNG</span>
              </FormLabel>

              {reportName ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="size-4 text-primary shrink-0" />
                    <span className="truncate font-medium">{reportName}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      form.setValue("reportName", "");
                      form.setValue("reportUrl", "");
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center rounded-md border border-dashed p-3 hover:bg-muted/50 cursor-pointer transition-colors">
                  <Upload className="size-4 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground font-medium">点击上传批次检测报告文件</span>
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "登记中..." : "确认入池"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
