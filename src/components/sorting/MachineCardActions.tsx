"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Edit2,
  Power,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  calibrateMachineAction,
  updateSortMachineNameAction,
  toggleSortMachineStatusAction,
  deleteSortMachineAction,
} from "@/actions/production";

export function MachineCardActions({
  machine,
  tasksCount,
}: {
  machine: {
    id: string;
    code: string;
    name: string;
    status: string;
    lastCalibrationStatus: string;
    lastCalibratedAt?: Date | string | null;
  };
  tasksCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(machine.name);

  const handleSetCalibration = (status: "QUALIFIED" | "PENDING" | "EXCEPTION") => {
    startTransition(async () => {
      const res = await calibrateMachineAction(machine.id, status);
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    });
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("名称不能为空");
      return;
    }
    startTransition(async () => {
      const res = await updateSortMachineNameAction(machine.id, newName);
      if (res.success) {
        toast.success(res.message);
        setRenameOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleToggleStatus = () => {
    startTransition(async () => {
      const res = await toggleSortMachineStatusAction(machine.id);
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    });
  };

  const handleDelete = () => {
    if (tasksCount > 0) {
      toast.error("该设备名下已有分拣任务，禁止删除！");
      return;
    }
    if (!confirm(`确认删除分拣设备 ${machine.name} (${machine.code}) 吗？`)) return;

    startTransition(async () => {
      const res = await deleteSortMachineAction(machine.id);
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    });
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              className={`h-6 px-2 text-[10px] gap-1 cursor-pointer font-medium ${
                machine.lastCalibrationStatus === "QUALIFIED"
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                  : machine.lastCalibrationStatus === "EXCEPTION"
                  ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 animate-pulse"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
              }`}
            >
              {isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : machine.lastCalibrationStatus === "QUALIFIED" ? (
                <CheckCircle2 className="size-3" />
              ) : machine.lastCalibrationStatus === "EXCEPTION" ? (
                <AlertTriangle className="size-3" />
              ) : (
                <Clock className="size-3" />
              )}
              <span>
                {machine.lastCalibrationStatus === "QUALIFIED"
                  ? "校验合格"
                  : machine.lastCalibrationStatus === "EXCEPTION"
                  ? "⚠️ 校验异常"
                  : "待校验"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              模拟校准状态切换
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleSetCalibration("QUALIFIED")}
              className="text-emerald-600 text-xs gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="size-3.5" /> 设为【校验合格】(准予开机)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleSetCalibration("EXCEPTION")}
              className="text-destructive text-xs gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="size-3.5" /> 设为【校验异常】(联锁拦截)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleSetCalibration("PENDING")}
              className="text-amber-600 text-xs gap-1.5 cursor-pointer"
            >
              <Clock className="size-3.5" /> 设为【待校验】
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={() => setRenameOpen(true)} className="gap-2 cursor-pointer">
              <Edit2 className="size-3.5" /> 重命名
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleStatus} className="gap-2 cursor-pointer">
              <Power className="size-3.5" />
              {machine.status === "ACTIVE" ? "停用设备" : "启用设备"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              disabled={tasksCount > 0}
              className={`gap-2 cursor-pointer ${
                tasksCount > 0 ? "text-muted-foreground opacity-50" : "text-destructive"
              }`}
            >
              <Trash2 className="size-3.5" />
              {tasksCount > 0 ? "有任务不可删" : "删除设备"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">修改分拣机名称</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              设备编号：{machine.code}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">设备名称</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-xs font-medium"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setRenameOpen(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-7 text-xs"
                disabled={isPending || !newName.trim()}
              >
                {isPending && <Loader2 className="size-3 animate-spin mr-1" />}
                保存
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
