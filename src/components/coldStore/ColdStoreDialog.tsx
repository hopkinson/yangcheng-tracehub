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
import { ThermometerSnowflake, Plus, Trash2, Edit2, Check, X, Loader2 } from "lucide-react";
import { createColdStoreAction, updateColdStoreAction, deleteColdStoreAction } from "@/actions/production";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function ColdStoreDialog({
  stores,
}: {
  stores: Array<{ id: string; code: string; name: string; targetTemp: number; _count?: { logs: number } }>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [temp, setTemp] = useState("4.5");

  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTemp, setEditTemp] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      const res = await createColdStoreAction({ name, targetTemp: parseFloat(temp) || 4.5 });
      if (res.success) {
        toast.success(res.message);
        setName("");
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleStartEdit = (s: { id: string; name: string; targetTemp: number }) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditTemp(String(s.targetTemp));
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) {
      toast.error("库位名称不能为空");
      return;
    }
    startTransition(async () => {
      const res = await updateColdStoreAction(id, {
        name: editName.trim(),
        targetTemp: parseFloat(editTemp) || 4.5,
      });
      if (res.success) {
        toast.success(res.message);
        setEditingId(null);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    startTransition(async () => {
      const res = await deleteColdStoreAction(deleteTarget.id);
      if (res.success) {
        toast.success(res.message);
        setDeleteTarget(null);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
          <ThermometerSnowflake className="size-4 text-primary" />
          库位配置
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <ThermometerSnowflake className="size-5 text-primary" />
            保鲜库位管理
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            配置预冷保鲜仓位与目标控温（4~5℃），支持重命名与温控微调。已有入库台账存量的库位禁止删除。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-3 py-2 border-b">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-[11px]">库位名称</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：保鲜预冷D区"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">目标温度 (℃)</Label>
              <Input
                type="number"
                step="0.1"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="h-8 text-xs font-mono text-right"
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={isPending || !name.trim()} className="h-8 text-xs w-full gap-1">
            <Plus className="size-3.5" />
            新增保鲜库位
          </Button>
        </form>

        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
          {stores.map((s) => {
            const hasLogs = (s._count?.logs || 0) > 0;
            const isEditing = editingId === s.id;

            if (isEditing) {
              return (
                <div key={s.id} className="p-2.5 bg-muted/30 flex items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-foreground shrink-0">{s.code}</span>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-xs flex-1"
                    placeholder="库位名称"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <Input
                      type="number"
                      step="0.1"
                      value={editTemp}
                      onChange={(e) => setEditTemp(e.target.value)}
                      className="h-7 w-16 text-xs font-mono text-right"
                      placeholder="温度"
                    />
                    <span className="text-[11px] text-muted-foreground">℃</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSaveEdit(s.id)}
                    disabled={isPending}
                    className="h-7 px-1.5 text-primary text-xs"
                    title="保存"
                  >
                    <Check className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                    disabled={isPending}
                    className="h-7 px-1.5 text-muted-foreground text-xs"
                    title="取消"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              );
            }

            return (
              <div key={s.id} className="flex items-center justify-between p-2.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-foreground mr-1">{s.code}</span>
                  <span className="text-foreground">{s.name}</span>
                  <span className="text-[11px] text-primary font-mono ml-1">({s.targetTemp}℃)</span>
                  {hasLogs && (
                    <span className="text-[10px] text-muted-foreground ml-1">({s._count?.logs} 笔入库)</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStartEdit(s)}
                    disabled={isPending}
                    className="h-6 px-1.5 text-muted-foreground hover:text-foreground text-xs"
                    title="改名/编辑温度"
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                  {!hasLogs && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget({ id: s.id, name: s.name })}
                      disabled={isPending}
                      className="h-6 px-1.5 text-destructive text-xs"
                      title="删除库位"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="确认删除保鲜库位"
        description={`确定要删除保鲜库位【${deleteTarget?.name}】吗？\n\n注意：此操作不可撤销。`}
        confirmText="确认删除"
        loading={isPending}
        onConfirm={handleConfirmDelete}
      />
    </Dialog>
  );
}
