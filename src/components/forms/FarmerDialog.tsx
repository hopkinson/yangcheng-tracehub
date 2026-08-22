"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { createFarmerAction, updateFarmerAction } from "@/actions/farmers";
import { farmerFormSchema, type FarmerFormValues } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { Plus, Edit2, Scale } from "lucide-react";

interface FarmerData {
  id: string;
  code: string;
  name: string;
  phone: string;
  farmType: string;
  area: number;
  quota?: number;
  creditRating: string;
  status: string;
  enclosures: Array<{ id: string; code: string }>;
}

const getFarmerValues = (farmer?: FarmerData): FarmerFormValues => ({
  name: farmer?.name || "",
  phone: farmer?.phone || "",
  farmType: (farmer?.farmType as "LAKE_CRAB" | "POND_CRAB") || "LAKE_CRAB",
  area: farmer?.area ?? 10,
  creditRating: (farmer?.creditRating as "A" | "B" | "C") || "A",
  status: (farmer?.status as "ACTIVE" | "SUSPENDED") || "ACTIVE",
  enclosuresStr: farmer?.enclosures?.map((e) => e.code).join(", ") || "W-01",
});

export interface FarmerWithStats extends FarmerData {
  quota: number;
  cumulativeInPool: number;
  cumulativeClaimed: number;
  cumulativeOutbound: number;
  remainingQuota: number;
}

export function FarmerDialog({
  farmer,
  userId,
  trigger,
  controlledOpen,
  onControlledOpenChange,
}: {
  farmer?: FarmerData;
  userId: string;
  trigger?: React.ReactNode;
  controlledOpen?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditing = !!farmer;
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (isControlled) {
      onControlledOpenChange?.(val);
    } else {
      setInternalOpen(val);
    }
  };

  const defaultValues = useMemo(() => getFarmerValues(farmer), [farmer]);
  const form = useForm<FarmerFormValues>({
    resolver: zodResolver(farmerFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) form.reset(getFarmerValues(farmer));
  }, [open, farmer, form]);

  const watchedArea = form.watch("area");
  const numArea = typeof watchedArea === "number" ? watchedArea : parseFloat(watchedArea) || 0;
  const calculatedQuota = Math.round(Math.max(0, numArea) * 600);

  async function onSubmit(data: FarmerFormValues) {
    const enclosureCodes = data.enclosuresStr
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (enclosureCodes.length === 0) {
      form.setError("enclosuresStr", { message: "请至少填写一个有效的围网编号" });
      return;
    }

    setLoading(true);
    try {
      if (isEditing && farmer) {
        await updateFarmerAction({
          id: farmer.id,
          name: data.name,
          phone: data.phone,
          farmType: data.farmType,
          area: Number(data.area),
          creditRating: data.creditRating,
          status: data.status,
          enclosureCodes,
          userId,
        });
        toast.success("养殖户档案及额度更新成功！");
      } else {
        await createFarmerAction({
          name: data.name,
          phone: data.phone,
          farmType: data.farmType,
          area: Number(data.area),
          creditRating: data.creditRating,
          enclosureCodes,
          userId,
        });
        toast.success("签约养殖户建档成功！");
      }
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null
      ) : (
        <DialogTrigger asChild>
          {isEditing ? (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
              <Edit2 className="size-3.5" />
            </Button>
          ) : (
            <Button className="flex items-center gap-2">
              <Plus className="size-4" data-icon="inline-start" />
              新增签约养殖户
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            <DialogTitle>{isEditing ? `编辑养殖户档案 (${farmer?.code})` : "新增签约养殖户与额度核定"}</DialogTitle>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>养殖户姓名</FormLabel>
                    <FormControl>
                      <Input placeholder="如：张建国" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>联系电话</FormLabel>
                    <FormControl>
                      <Input placeholder="如：13812345678" maxLength={11} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="farmType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>养殖类型</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="LAKE_CRAB">湖蟹</SelectItem>
                        <SelectItem value="POND_CRAB">塘蟹</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="creditRating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>信用等级</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue>{field.value ? `${field.value} 级` : undefined}</SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="min-w-[18rem]">
                        <SelectItem value="A">
                          <div className="flex w-full items-center justify-between gap-4 pr-1">
                            <span className="font-medium">A 级</span>
                            <span className="text-xs text-muted-foreground">连续3年履约无异常</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="B">
                          <div className="flex w-full items-center justify-between gap-4 pr-1">
                            <span className="font-medium">B 级</span>
                            <span className="text-xs text-muted-foreground">1-2年履约或轻微违约</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="C">
                          <div className="flex w-full items-center justify-between gap-4 pr-1">
                            <span className="font-medium">C 级</span>
                            <span className="text-xs text-muted-foreground">新户或曾有违约</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="area"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>养殖面积 (亩)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" min="0.1" placeholder="如：10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-md border bg-primary/5 p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">系统实时核定年度总额度:</span>
              <span className="font-mono font-bold text-lg text-primary">
                {calculatedQuota.toLocaleString()} 只
              </span>
            </div>

            <FormField
              control={form.control}
              name="enclosuresStr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名下围网水域编号 (逗号分隔)</FormLabel>
                  <FormControl>
                    <Input placeholder="如：W-01, W-02" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEditing && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>合作状态</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ACTIVE">正常合作</SelectItem>
                        <SelectItem value="SUSPENDED">暂停供应</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "保存中..." : "确认保存"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function FarmerDetailDialog({
  farmer,
  userId,
  children,
}: {
  farmer: FarmerWithStats;
  userId: string;
  children: React.ReactNode;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const enclosureStr = farmer.enclosures.map((e) => e.code).join(", ") || "无";
  const quota = farmer.quota || 1;

  const inPoolPct = Math.min(100, (farmer.cumulativeInPool / quota) * 100);
  const claimedPct = Math.min(100, (farmer.cumulativeClaimed / quota) * 100);
  const outboundPct = Math.min(100, (farmer.cumulativeOutbound / quota) * 100);

  return (
    <>
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-[540px] p-6 bg-card text-card-foreground border-border/80 shadow-2xl">
          <DialogHeader className="pb-1 text-left">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {farmer.name} · {farmer.code}
            </DialogTitle>
          </DialogHeader>

          {/* 基础信息 2列网格 */}
          <div className="grid grid-cols-2 gap-y-3.5 gap-x-8 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">联系方式</span>
              <span className="font-mono font-medium">{farmer.phone}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">养殖类型</span>
              <span>{farmer.farmType === "LAKE_CRAB" ? "湖蟹" : "塘蟹"}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">围网编号</span>
              <span className="font-mono font-medium">{enclosureStr}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">养殖面积</span>
              <span className="font-mono font-medium">{farmer.area} 亩</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">信用评级</span>
              <span className="font-medium">{farmer.creditRating} 级</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">合作状态</span>
              <span>{farmer.status === "ACTIVE" ? "合作中" : "暂停"}</span>
            </div>
          </div>

          {/* 数量闭环统计卡片 */}
          <div className="rounded-xl border border-border/60 bg-muted/40 p-4 space-y-3 mt-1">
            <div className="text-xs text-muted-foreground font-medium">
              数量闭环 · 按养殖户归集
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                { label: "年度额度", val: farmer.quota, pct: 100, bar: "bg-primary", txt: "text-primary" },
                { label: "累计入池", val: farmer.cumulativeInPool, pct: inPoolPct, bar: "bg-blue-500 dark:bg-blue-400", txt: "text-blue-600 dark:text-blue-400" },
                { label: "累计领扣", val: farmer.cumulativeClaimed, pct: claimedPct, bar: "bg-amber-500 dark:bg-amber-400", txt: "text-amber-600 dark:text-amber-400" },
                { label: "累计出库", val: farmer.cumulativeOutbound, pct: outboundPct, bar: "bg-emerald-500 dark:bg-emerald-400", txt: "text-emerald-600 dark:text-emerald-400" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-muted-foreground">{item.label}</span>
                  <div className="relative h-2 flex-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${item.bar}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                  <span className={`w-14 text-right font-mono font-bold ${item.txt}`}>
                    {item.val.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1.5 text-xs border-t border-border/30">
              <span className="text-muted-foreground">剩余可用额度</span>
              <span
                className={`font-mono font-semibold ${
                  (farmer.remainingQuota / quota) <= 0.1
                    ? "text-destructive"
                    : (farmer.remainingQuota / quota) <= 0.3
                    ? "text-amber-500"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {farmer.remainingQuota.toLocaleString()} 只 (余 {Math.round((farmer.remainingQuota / quota) * 100)}%)
              </span>
            </div>
          </div>

          {/* 弹窗底部操作 */}
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              className="border-border/80 hover:bg-muted font-medium px-4"
              onClick={() => {
                setDetailOpen(false);
                setEditOpen(true);
              }}
            >
              编辑档案
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <FarmerDialog
        farmer={farmer}
        userId={userId}
        trigger={null}
        controlledOpen={editOpen}
        onControlledOpenChange={setEditOpen}
      />
    </>
  );
}
