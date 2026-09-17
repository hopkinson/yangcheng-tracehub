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
import { ThermometerSnowflake, Plus, Loader2, AlertCircle, Layers } from "lucide-react";
import { createBatchColdIntakeAction } from "@/actions/production";

export interface ColdStoreOption {
  id: string;
  code: string;
  name: string;
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

export interface SourceBatchOption {
  id: string;
  code: string;
  availableCount: number;
  tasks: SortTaskOption[];
}

export function ColdIntakeDialog({
  stores,
  sourceBatches = [],
  defaultStoreId,
  trigger,
}: {
  stores: ColdStoreOption[];
  sourceBatches?: SourceBatchOption[];
  defaultStoreId?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initialSourceBatch = sourceBatches.find((b) => b.availableCount > 0) || sourceBatches[0];

  const [storeId, setStoreId] = useState(defaultStoreId || stores[0]?.id || "");
  const [selectedSourceBatchId, setSelectedSourceBatchId] = useState(initialSourceBatch?.id || "");
  const [selectedTaskIds, setSelectedTaskIds] = useState<Record<string, boolean>>({});
  const [genderFilter, setGenderFilter] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const [operator, setOperator] = useState("李仓管");

  const currentBatch = sourceBatches.find((b) => b.id === selectedSourceBatchId);
  const currentTasks = currentBatch?.tasks || [];
  const currentBatchAvailable = currentBatch?.availableCount ?? 0;

  const filteredTasks = currentTasks.filter((t) => genderFilter === "ALL" || t.gender === genderFilter);
  const maleTasks = currentTasks.filter((t) => t.gender === "MALE" && t.availableCount > 0);
  const femaleTasks = currentTasks.filter((t) => t.gender === "FEMALE" && t.availableCount > 0);
  const availableTasks = currentTasks.filter((t) => t.availableCount > 0);

  const selectedTasksList = currentTasks.filter((t) => selectedTaskIds[t.id] && t.availableCount > 0);
  const selectedCount = selectedTasksList.length;
  const totalIntakeCount = selectedTasksList.reduce((acc, t) => acc + t.availableCount, 0);

  const handleSourceBatchChange = (batchId: string) => {
    setSelectedSourceBatchId(batchId);
    setSelectedTaskIds({});
    setGenderFilter("ALL");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const activeSource = sourceBatches.find((b) => b.availableCount > 0) || sourceBatches[0];
      setSelectedSourceBatchId(activeSource?.id || "");
      setSelectedTaskIds({});
      setGenderFilter("ALL");
    }
    setOpen(nextOpen);
  };

  const handleToggleTask = (taskId: string) => {
    setSelectedTaskIds(({ [taskId]: _, ...rest }) => (taskId in selectedTaskIds ? rest : { ...selectedTaskIds, [taskId]: true }));
  };

  const selectTasks = (tasksToSelect: SortTaskOption[]) => {
    setSelectedTaskIds(Object.fromEntries(tasksToSelect.map((t) => [t.id, true])));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentStoreId = defaultStoreId || storeId || stores[0]?.id || "";
    if (!currentStoreId) {
      toast.error("请选择目标保鲜库");
      return;
    }
    if (!selectedSourceBatchId) {
      toast.error("请选择原料批次");
      return;
    }
    const taskIds = Object.keys(selectedTaskIds).filter((id) => selectedTaskIds[id]);
    if (taskIds.length === 0) {
      toast.error("请至少勾选一个待入库的分拣批次");
      return;
    }

    startTransition(async () => {
      const res = await createBatchColdIntakeAction({
        storeId: currentStoreId,
        sortTaskIds: taskIds,
        operator,
      });

      if (res.success) {
        toast.success(res.message);
        setSelectedTaskIds({});
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="h-9 gap-1.5 bg-primary text-primary-foreground font-medium shadow-xs">
            <Plus className="size-4" />
            保鲜入库登记 (CR)
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <ThermometerSnowflake className="size-5 text-primary" />
            成品大闸蟹保鲜预冷入库登记
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            保鲜库【只入不出】，入库数量受分拣合格量严格约束，整批全量入库不拆分，发货统一经由「出库管理」审批。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto px-1">
          {/* 1. 顶部配置区：目标保鲜库、原料批次与经手人 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">目标保鲜库</Label>
              <Select value={defaultStoreId || storeId} onValueChange={setStoreId} disabled={!!defaultStoreId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="选择保鲜库" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                原料批次 <span className="text-[11px] text-muted-foreground">（按入池先进先出）</span>
              </Label>
              <Select value={selectedSourceBatchId} onValueChange={handleSourceBatchChange}>
                <SelectTrigger className="h-9 text-xs font-mono">
                  <SelectValue placeholder="选择原料批次" />
                </SelectTrigger>
                <SelectContent>
                  {sourceBatches.length === 0 ? (
                    <SelectItem value="none" disabled className="text-xs">
                      暂无可入库的分拣原料批次
                    </SelectItem>
                  ) : (
                    sourceBatches.map((batch, index) => (
                      <SelectItem key={batch.id} value={batch.id} className="text-xs font-mono">
                        {batch.code} · {batch.availableCount > 0 ? `待入库 ${batch.availableCount} 只` : "已全部入库"}
                        {index === 0 ? " · 当前优先" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">操作经手人</Label>
              <Input
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="h-9 text-xs"
                placeholder="操作经手人"
              />
            </div>
          </div>

          {currentBatch && currentBatchAvailable <= 0 && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>该原料批次的所有分拣大闸蟹已全部完成入库（待入库余量 0 只），不可重复登记。</span>
            </div>
          )}

          {/* 2. 分拣规格明细多选区域 (整体交互对齐分拣任务) */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Layers className="size-4 text-primary" />
                <Label className="text-xs font-semibold">选择待入库分拣批次</Label>
                <span className="text-[11px] text-muted-foreground">
                  (共 {currentTasks.length} 个规格 · 待入库 {availableTasks.length} 个)
                </span>
              </div>

              {/* 快筛与一键操作按钮组 */}
              <div className="flex items-center flex-wrap gap-1.5 text-xs">
                {/* 视图过滤 */}
                <div className="flex items-center rounded border bg-background p-0.5 text-[11px]">
                  {(["ALL", "MALE", "FEMALE"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setGenderFilter(key)}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        genderFilter === key
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {key === "ALL"
                        ? `全部(${currentTasks.length})`
                        : key === "MALE"
                        ? `公(${maleTasks.length})`
                        : `母(${femaleTasks.length})`}
                    </button>
                  ))}
                </div>

                {/* 一键快捷选 */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectTasks(maleTasks)}
                  disabled={maleTasks.length === 0}
                  className="h-6 px-2 text-[11px] border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                >
                  一键选公
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectTasks(femaleTasks)}
                  disabled={femaleTasks.length === 0}
                  className="h-6 px-2 text-[11px] border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  一键选母
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => selectTasks(availableTasks)}
                  className="h-6 px-1.5 text-[11px]"
                  disabled={availableTasks.length === 0}
                >
                  全选
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTaskIds({})}
                  className="h-6 px-1.5 text-[11px] text-muted-foreground"
                  disabled={selectedCount === 0}
                >
                  清空
                </Button>
              </div>
            </div>

            {/* 批次规格明细卡片列表 */}
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {currentTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded">
                  该原料批次暂无可用分拣规格明细
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded">
                  当前筛选条件下无匹配的规格明细
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const isExhausted = task.availableCount <= 0;
                  const isChecked = !!selectedTaskIds[task.id] && !isExhausted;
                  const isMale = task.gender === "MALE";

                  return (
                    <div
                      key={task.id}
                      className={`flex items-center justify-between gap-3 p-2 rounded border text-xs transition-colors ${
                        isExhausted
                          ? "opacity-60 bg-muted/30 cursor-not-allowed border-dashed"
                          : isChecked
                          ? "bg-primary/10 border-primary/40 font-medium"
                          : "bg-background hover:bg-muted/40"
                      }`}
                    >
                      <label
                        className={`flex items-center gap-2.5 flex-1 select-none ${
                          isExhausted ? "cursor-not-allowed" : "cursor-pointer"
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          if (isExhausted) return;
                          handleToggleTask(task.id);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isExhausted}
                          onChange={() => {}}
                          className="size-3.5 accent-primary cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="font-mono font-semibold">{task.code}</span>
                        <span
                          className={
                            isMale
                              ? "text-sky-600 dark:text-sky-400 font-medium"
                              : "text-rose-600 dark:text-rose-400 font-medium"
                          }
                        >
                          {isMale ? "公蟹" : "母蟹"} · {task.weightTier}
                        </span>
                      </label>

                      <div className="flex items-center gap-3 text-right">
                        <span className="text-muted-foreground text-[11px]">
                          合格 {task.qualifiedCount} 只
                        </span>
                        <span
                          className={`font-mono text-xs ${
                            isExhausted ? "text-muted-foreground line-through" : "text-primary font-bold"
                          }`}
                        >
                          {isExhausted ? "已入清" : `入库 ${task.availableCount} 只`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 规格明细底部统计栏 (整批全量不拆分) */}
            <div className="flex items-center justify-between pt-2 border-t text-xs">
              <span className="text-muted-foreground">
                已选 <strong className="font-mono text-foreground font-bold">{selectedCount}</strong> 个规格
              </span>
              <span className="text-muted-foreground font-sans">
                合计入库: <strong className="font-mono text-base font-bold text-primary">{totalIntakeCount}</strong> 只
                <span className="text-[11px] text-muted-foreground ml-1.5">（整批全量入库）</span>
              </span>
            </div>
          </div>

          {/* 3. 底部操作按钮 */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || selectedCount === 0 || totalIntakeCount <= 0}
              className="gap-1.5 bg-primary text-primary-foreground font-medium"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              确认登记入库 ({totalIntakeCount} 只)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
