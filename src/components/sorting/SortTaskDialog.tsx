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
import { Scale, Plus, Loader2, AlertCircle } from "lucide-react";
import { createSortTaskAction } from "@/actions/production";

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
  const [selectedLineIdx, setSelectedLineIdx] = useState<number>(0);
  const [inputCount, setInputCount] = useState<number>(0);

  const selectedMachine = machines.find((m) => m.id === selectedMachineId);
  const isMachineDisabled = selectedMachine?.status === "DISABLED";
  const isMachineBlocked = selectedMachine?.lastCalibrationStatus === "EXCEPTION" || isMachineDisabled;

  const currentBundle = completedBundles.find((b) => b.id === selectedBundleId);
  const currentLines = currentBundle?.lines || [];
  const currentLine = currentLines[selectedLineIdx] || currentLines[0];

  const handleBundleChange = (bundleId: string) => {
    setSelectedBundleId(bundleId);
    setSelectedLineIdx(0);
    const b = completedBundles.find((x) => x.id === bundleId);
    if (b && b.lines.length > 0) {
      setInputCount(b.lines[0].count);
    }
  };

  const handleLineChange = (idxStr: string) => {
    const idx = parseInt(idxStr, 10);
    setSelectedLineIdx(idx);
    if (currentLines[idx]) {
      setInputCount(currentLines[idx].count);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId || !selectedBundleId || !currentLine) {
      toast.error("请选择完整分拣设备与捆扎批次");
      return;
    }
    if (isMachineBlocked) {
      toast.error("该设备校准未通过，安全联锁禁止开机作业！");
      return;
    }
    if (inputCount <= 0 || inputCount > currentLine.count) {
      toast.error(`投入数量必须大于 0 且不超过捆扎明细数量（上限 ${currentLine.count} 只）`);
      return;
    }

    startTransition(async () => {
      const res = await createSortTaskAction({
        machineId: selectedMachineId,
        bundleBatchId: selectedBundleId,
        gender: currentLine.gender,
        weightTier: currentLine.weightTier,
        inputCount,
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
        <Button className="h-9 gap-1.5 bg-primary text-primary-foreground font-medium shadow-xs">
          <Plus className="size-4" />
          新建分拣任务 (FJR)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Scale className="size-5 text-primary" />
            创建机器分拣称重任务
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            仅支持选择当日【已完成捆扎】的批次，分拣机必须校准合格方允许开机。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* 选择分拣机 */}
          <div className="space-y-1.5">
            <Label className="text-xs">作业分拣机</Label>
            <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="选择分拣机" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name} ({m.code}) · {m.status === "DISABLED" ? "⛔ 已停用" : m.lastCalibrationStatus === "QUALIFIED" ? "校验合格" : m.lastCalibrationStatus === "EXCEPTION" ? "⚠️ 校验异常" : "待校验"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isMachineBlocked && (
              <div className="p-2 rounded bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-1.5">
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  {isMachineDisabled
                    ? "该设备处于【停用】状态，禁止开机作业！"
                    : "该分拣机精度校准异常，已被系统安全联锁强制锁定，禁止开机作业！"}
                </span>
              </div>
            )}
          </div>

          {/* 来源捆扎批次 (仅已完成) */}
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

          {/* 规格行选择 */}
          {currentLines.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">选择分规规格明细</Label>
              <Select value={String(selectedLineIdx)} onValueChange={handleLineChange}>
                <SelectTrigger className="h-9 text-xs font-mono">
                  <SelectValue placeholder="选择规格行" />
                </SelectTrigger>
                <SelectContent>
                  {currentLines.map((l, idx) => (
                    <SelectItem key={l.id} value={String(idx)} className="text-xs font-mono">
                      {l.poolCode} 来源 · {l.gender === "FEMALE" ? "母蟹" : "公蟹"} {l.weightTier}（总计 {l.count} 只）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 投入只数 */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              投入分拣只数 <span className="text-[11px] text-muted-foreground">(≤ {currentLine?.count || 0} 只)</span>
            </Label>
            <Input
              type="number"
              min={1}
              max={currentLine?.count || 10000}
              value={inputCount || ""}
              onChange={(e) => setInputCount(parseInt(e.target.value, 10) || 0)}
              className="h-9 text-xs font-mono text-right"
              placeholder="请输入投入只数"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || isMachineBlocked || completedBundles.length === 0}
              className="gap-1.5 bg-primary text-primary-foreground font-medium"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              确认开机并创建任务
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
