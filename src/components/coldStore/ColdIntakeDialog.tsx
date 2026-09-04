"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThermometerSnowflake, Plus, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createColdIntakeAction } from "@/actions/production";

export interface ColdStoreOption {
  id: string;
  code: string;
  name: string;
  targetTemp: number;
}

export interface SortTaskOption {
  id: string;
  code: string;
  gender: string;
  weightTier: string;
  qualifiedCount: number;
  alreadyIntakeCount: number;
  availableCount: number;
}

export function ColdIntakeDialog({
  stores,
  sortTasks = [],
  defaultStoreId,
  trigger,
}: {
  stores: ColdStoreOption[];
  sortTasks?: SortTaskOption[];
  defaultStoreId?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [storeId, setStoreId] = useState(defaultStoreId || stores[0]?.id || "");
  const [refId, setRefId] = useState(sortTasks.find((t) => t.availableCount > 0)?.code || sortTasks[0]?.code || "");
  
  // 默认初始只数联动所选批次的可用余量
  const initialTask = sortTasks.find((t) => t.code === refId || t.id === refId);
  const [count, setCount] = useState<number>(initialTask ? Math.max(0, initialTask.availableCount) : 500);
  const [operator, setOperator] = useState("李仓管");

  const currentStoreId = defaultStoreId || storeId || stores[0]?.id || "";
  const selectedTask = sortTasks.find((t) => t.code === refId || t.id === refId);

  // 切换分拣批次时联动更新余量
  const handleSelectTask = (taskCode: string) => {
    setRefId(taskCode);
    const found = sortTasks.find((t) => t.code === taskCode || t.id === taskCode);
    if (found) setCount(Math.max(0, found.availableCount));
  };

  const isOverLimit = selectedTask ? count > selectedTask.availableCount : false;
  const isZeroOrNegative = count <= 0;
  const isAvailableExhausted = selectedTask ? selectedTask.availableCount <= 0 : false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStoreId) {
      toast.error("请选择目标保鲜库");
      return;
    }
    if (!refId) {
      toast.error("请选择关联的分拣批次");
      return;
    }
    if (count <= 0) {
      toast.error("请输入有效的入库数量 (大于 0)");
      return;
    }
    if (selectedTask && count > selectedTask.availableCount) {
      toast.error(`入库数量 (${count} 只) 超出该分拣批次剩余可入库上限 (${selectedTask.availableCount} 只)`);
      return;
    }

    startTransition(async () => {
      const res = await createColdIntakeAction({
        storeId: currentStoreId,
        count,
        refType: "SORT",
        refId: refId.trim(),
        operator,
      });

      if (res.success) {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="h-9 gap-1.5 bg-primary text-primary-foreground font-medium shadow-xs">
            <Plus className="size-4" />
            保鲜入库登记 (CR)
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <ThermometerSnowflake className="size-5 text-primary" />
            成品大闸蟹保鲜预冷入库登记
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            保鲜库【只入不出】，入库数量受分拣合格量严格约束，发货经由「出库管理」审批。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* 1. 目标保鲜库 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">目标保鲜库</Label>
            <Select value={currentStoreId} onValueChange={setStoreId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="选择保鲜库" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name} ({s.code}) · 目标 {s.targetTemp}℃
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. 关联分拣批次选择器 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">
                关联分拣批次任务号 <span className="text-destructive">*</span>
              </Label>
              {selectedTask && (
                <span className="text-[11px] font-mono text-muted-foreground">
                  合格 {selectedTask.qualifiedCount} 只 · 现余 {selectedTask.availableCount} 只
                </span>
              )}
            </div>

            <Select value={refId} onValueChange={handleSelectTask}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="请选择已完成分拣批次" />
              </SelectTrigger>
              <SelectContent>
                {sortTasks.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground text-center">
                    暂无可入库的分拣任务批次
                  </div>
                ) : (
                  sortTasks.map((t) => (
                    <SelectItem key={t.id} value={t.code} disabled={t.availableCount <= 0} className="text-xs">
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span className="font-mono font-medium">{t.code}</span>
                        <span className="text-muted-foreground">({t.gender === "FEMALE" ? "母蟹" : "公蟹"} {t.weightTier})</span>
                        <span className={`font-mono text-[11px] ${t.availableCount <= 0 ? "text-muted-foreground line-through" : "text-primary font-bold"}`}>
                          {t.availableCount <= 0 ? "已入清" : `余 ${t.availableCount} 只`}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 3. 选定分拣批次的规格与余量指标卡 */}
          {selectedTask && (
            <div className="p-2.5 rounded-lg border border-border/70 bg-muted/20 space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>分拣规格档位:</span>
                <span className="font-medium text-foreground">
                  {selectedTask.gender === "FEMALE" ? "母蟹" : "公蟹"} {selectedTask.weightTier}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>分拣合格总数 / 已预冷入库:</span>
                <span className="text-foreground">
                  {selectedTask.qualifiedCount} 只 / {selectedTask.alreadyIntakeCount} 只
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border/50 font-sans">
                <span className="font-medium text-foreground">本批次当前剩余可入库上限:</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    selectedTask.availableCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  }`}
                >
                  {selectedTask.availableCount} 只
                </span>
              </div>
            </div>
          )}

          {/* 4. 入库只数 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">入库只数 (只)</Label>
              {selectedTask && selectedTask.availableCount > 0 && (
                <button
                  type="button"
                  onClick={() => setCount(selectedTask.availableCount)}
                  className="text-[11px] text-primary hover:underline"
                >
                  填入最大余量 ({selectedTask.availableCount} 只)
                </button>
              )}
            </div>
            <Input
              type="number"
              min={1}
              max={selectedTask ? selectedTask.availableCount : undefined}
              value={count || ""}
              onChange={(e) => setCount(parseInt(e.target.value, 10) || 0)}
              className={`h-9 text-sm font-mono text-right font-bold ${
                isOverLimit ? "border-destructive focus-visible:ring-destructive text-destructive" : ""
              }`}
              placeholder="请输入入库数量"
            />
          </div>

          {/* 超额告警提示 */}
          {isOverLimit && selectedTask && (
            <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 p-2.5 rounded-md border border-destructive/20 font-medium">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                入库只数 ({count} 只) 超出分拣批次剩余可入库上限 ({selectedTask.availableCount} 只)，严禁超额入库！
              </span>
            </div>
          )}

          {isAvailableExhausted && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 p-2 rounded-md border">
              <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" />
              <span>该分拣批次合格大闸蟹已全部完成入库，请选择其他分拣批次。</span>
            </div>
          )}

          {/* 5. 操作经手人 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">操作经手人</Label>
            <Input
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* 6. 底部操作按钮 */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || isZeroOrNegative || isOverLimit || !refId || isAvailableExhausted}
              className="gap-1.5 bg-primary text-primary-foreground font-medium"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              确认登记入库 ({count} 只)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
