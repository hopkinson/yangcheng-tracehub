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
import { Scale, Plus, Loader2, AlertCircle, Layers } from "lucide-react";
import { createSortTasksAction } from "@/actions/production";

export interface CompletedBundleOption {
  id: string;
  code: string;
  groupName: string;
  lines: Array<{
    id: string;
    gender: string;
    weightTier: string;
    count: number;
    poolCode: string;
  }>;
}

export interface MachineOption {
  id: string;
  code: string;
  name: string;
  status?: string;
  lastCalibrationStatus: string;
}

export function SortTaskDialog({
  machines,
  completedBundles,
}: {
  machines: MachineOption[];
  completedBundles: CompletedBundleOption[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [selectedMachineId, setSelectedMachineId] = useState(machines[0]?.id || "");
  const [selectedBundleId, setSelectedBundleId] = useState(completedBundles[0]?.id || "");
  const [selectedLines, setSelectedLines] = useState<Record<string, number>>({});
  const [genderFilter, setGenderFilter] = useState<"ALL" | "MALE" | "FEMALE">("ALL");

  const selectedMachine = machines.find((m) => m.id === selectedMachineId);
  const isMachineDisabled = selectedMachine?.status === "DISABLED";
  const isMachineBlocked = selectedMachine?.lastCalibrationStatus === "EXCEPTION" || isMachineDisabled;

  const currentBundle = completedBundles.find((b) => b.id === selectedBundleId);
  const currentLines = currentBundle?.lines || [];

  const filteredLines = currentLines.filter((l) => genderFilter === "ALL" || l.gender === genderFilter);
  const maleLines = currentLines.filter((l) => l.gender === "MALE");
  const femaleLines = currentLines.filter((l) => l.gender === "FEMALE");

  const selectedCount = Object.keys(selectedLines).length;
  const totalInputCount = Object.values(selectedLines).reduce((acc, cur) => acc + (cur || 0), 0);

  const handleBundleChange = (bundleId: string) => {
    setSelectedBundleId(bundleId);
    setSelectedLines({});
    setGenderFilter("ALL");
  };

  const handleToggleLine = (lineId: string, maxCount: number) => {
    setSelectedLines((prev) => {
      const next = { ...prev };
      if (lineId in next) delete next[lineId];
      else next[lineId] = maxCount;
      return next;
    });
  };

  const handleCountChange = (lineId: string, maxCount: number, val: number) => {
    setSelectedLines((prev) => ({
      ...prev,
      [lineId]: Math.max(1, Math.min(maxCount, val || 0)),
    }));
  };

  const selectLines = (lines: typeof currentLines) =>
    setSelectedLines(Object.fromEntries(lines.map((l) => [l.id, l.count])));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId || !selectedBundleId) {
      toast.error("请选择完整分拣设备与捆扎批次");
      return;
    }
    if (isMachineBlocked) {
      toast.error("该设备校准未通过，安全联锁禁止开机作业！");
      return;
    }

    const items = currentLines
      .filter((l) => l.id in selectedLines)
      .map((l) => ({
        lineId: l.id,
        gender: l.gender,
        weightTier: l.weightTier,
        inputCount: selectedLines[l.id],
      }));

    if (items.length === 0) {
      toast.error("请至少勾选一个分规规格明细");
      return;
    }

    const invalid = items.find((i) => i.inputCount <= 0);
    if (invalid) {
      toast.error("投入只数必须大于 0");
      return;
    }

    startTransition(async () => {
      const res = await createSortTasksAction({
        machineId: selectedMachineId,
        bundleBatchId: selectedBundleId,
        items,
      });

      if (res.success) {
        toast.success(res.message);
        setSelectedLines({});
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 gap-1.5 bg-primary text-primary-foreground font-medium shadow-xs">
          <Plus className="size-4" />
          新建分拣任务 (FJR)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Scale className="size-5 text-primary" />
            创建机器分拣称重任务
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            仅支持选择当日【已完成捆扎】的批次，分拣机必须校准合格方允许开机。支持多选规格明细批量建单。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto px-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">作业分拣机</Label>
              <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="选择分拣机" />
                </SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.name} ({m.code}) ·{" "}
                      {m.status === "DISABLED"
                        ? "⛔ 已停用"
                        : m.lastCalibrationStatus === "QUALIFIED"
                        ? "校验合格"
                        : m.lastCalibrationStatus === "EXCEPTION"
                        ? "⚠️ 校验异常"
                        : "待校验"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                来源捆扎批次 <span className="text-[11px] text-muted-foreground">（仅已完成批次可选）</span>
              </Label>
              <Select value={selectedBundleId} onValueChange={handleBundleChange}>
                <SelectTrigger className="h-9 text-xs font-mono">
                  <SelectValue placeholder="选择已完成捆扎批次" />
                </SelectTrigger>
                <SelectContent>
                  {completedBundles.length === 0 ? (
                    <SelectItem value="none" disabled className="text-xs">
                      暂无已完成捆扎批次，请先完成捆扎
                    </SelectItem>
                  ) : (
                    completedBundles.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="text-xs font-mono">
                        {b.code} ({b.groupName} · {b.lines.reduce((a, c) => a + c.count, 0)} 只)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isMachineBlocked && (
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>
                {isMachineDisabled
                  ? "该设备处于【停用】状态，禁止开机作业！"
                  : "该分拣机精度校准异常，已被系统安全联锁强制锁定，禁止开机作业！"}
              </span>
            </div>
          )}

          {/* 分规规格明细多选区域 */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Layers className="size-4 text-primary" />
                <Label className="text-xs font-semibold">选择分规规格明细</Label>
                <span className="text-[11px] text-muted-foreground">({currentLines.length} 个规格)</span>
              </div>

              {/* 快筛与一键操作 */}
              <div className="flex items-center flex-wrap gap-1.5 text-xs">
                {/* 视图过滤 */}
                <div className="flex items-center rounded border bg-background p-0.5 text-[11px]">
                  {(["ALL", "MALE", "FEMALE"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setGenderFilter(key)}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        genderFilter === key ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {key === "ALL" ? `全部(${currentLines.length})` : key === "MALE" ? `公(${maleLines.length})` : `母(${femaleLines.length})`}
                    </button>
                  ))}
                </div>

                {/* 一键快捷选 */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectLines(maleLines)}
                  disabled={maleLines.length === 0}
                  className="h-6 px-2 text-[11px] border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                >
                  一键选公
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectLines(femaleLines)}
                  disabled={femaleLines.length === 0}
                  className="h-6 px-2 text-[11px] border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  一键选母
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => selectLines(currentLines)}
                  className="h-6 px-1.5 text-[11px]"
                  disabled={currentLines.length === 0}
                >
                  全选
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLines({})}
                  className="h-6 px-1.5 text-[11px] text-muted-foreground"
                  disabled={selectedCount === 0}
                >
                  清空
                </Button>
              </div>
            </div>

            {/* 规格明细列表 */}
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {currentLines.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded">
                  该捆扎批次暂无可用规格明细
                </div>
              ) : filteredLines.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded">
                  当前筛选条件下无匹配的规格明细
                </div>
              ) : (
                filteredLines.map((line) => {
                  const isChecked = line.id in selectedLines;
                  const currentInputCount = selectedLines[line.id] ?? line.count;
                  const isMale = line.gender === "MALE";

                  return (
                    <div
                      key={line.id}
                      className={`flex items-center justify-between gap-3 p-2 rounded border text-xs transition-colors ${
                        isChecked ? "bg-primary/10 border-primary/40 font-medium" : "bg-background hover:bg-muted/40"
                      }`}
                    >
                      <label
                        className="flex items-center gap-2 flex-1 select-none cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          handleToggleLine(line.id, line.count);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="size-3.5 accent-primary cursor-pointer"
                        />
                        <span className="font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-[11px]">
                          {line.poolCode} 来源
                        </span>
                        <span className={`font-semibold ${isMale ? "text-sky-700 dark:text-sky-400" : "text-rose-700 dark:text-rose-400"}`}>
                          {isMale ? "公蟹" : "母蟹"} {line.weightTier}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          ({line.count} 只)
                        </span>
                      </label>

                      {isChecked && (
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Label className="text-[11px] text-muted-foreground">投入:</Label>
                          <Input
                            type="number"
                            min={1}
                            max={line.count}
                            value={currentInputCount}
                            onChange={(e) => handleCountChange(line.id, line.count, parseInt(e.target.value, 10))}
                            className="h-7 w-20 text-xs font-mono text-right"
                          />
                          <span className="text-[11px] text-muted-foreground font-mono">只</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 汇总统计 */}
            <div className="flex justify-between items-center pt-2 text-xs border-t">
              <span className="text-muted-foreground">
                已选 <strong className="text-foreground">{selectedCount}</strong> 个规格
              </span>
              <div className="flex items-center gap-2 font-mono font-bold text-foreground">
                <span>合计投入：</span>
                <span className="text-base text-primary">{totalInputCount} 只</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || isMachineBlocked || completedBundles.length === 0 || selectedCount === 0}
              className="gap-1.5 bg-primary text-primary-foreground font-medium"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              确认开机并创建任务 {selectedCount > 0 ? `(${selectedCount} 笔)` : ""}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


