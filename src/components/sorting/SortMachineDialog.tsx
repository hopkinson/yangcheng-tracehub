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
import { Plus, Cpu, Loader2 } from "lucide-react";
import { createSortMachineAction } from "@/actions/production";

export function SortMachineDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("请输入分拣机名称");
      return;
    }

    startTransition(async () => {
      const res = await createSortMachineAction(name.trim());
      if (res.success) {
        toast.success(res.message);
        setName("");
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 font-medium shadow-xs">
          <Plus className="size-4" />
          新增分拣设备
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Cpu className="size-5 text-primary" />
            新增分拣设备
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            自动分配 FJ-XX 编号，初始化状态为【校验合格】
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs">设备名称 / 型号</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：高速动态分拣机 G3"
              className="h-9 text-xs"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !name.trim()}
              className="gap-1.5 bg-primary text-primary-foreground font-medium"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              确认创建
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
