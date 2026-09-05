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
import { Users, Plus, Trash2, Loader2 } from "lucide-react";
import { createBundleGroupAction, deleteBundleGroupAction } from "@/actions/production";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function BundleGroupDialog({
  groups,
}: {
  groups: Array<{ id: string; code: string; name: string; _count?: { batches: number } }>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      const res = await createBundleGroupAction(name);
      if (res.success) {
        toast.success(res.message);
        setName("");
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    startTransition(async () => {
      const res = await deleteBundleGroupAction(deleteTarget.id);
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
          <Users className="size-4 text-primary" />
          班组配置
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="size-5 text-primary" />
            捆扎班组管理
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            配置现场作业班组（P1/P2/P3），已产生捆扎批次的班组禁止删除。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="flex items-center gap-2 py-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="班组名称，例如：捆扎四组"
            className="h-8 text-xs flex-1"
          />
          <Button type="submit" size="sm" disabled={isPending || !name.trim()} className="h-8 text-xs gap-1">
            <Plus className="size-3.5" />
            新增班组
          </Button>
        </form>

        <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
          {groups.map((g) => {
            const hasBatches = (g._count?.batches || 0) > 0;
            return (
              <div key={g.id} className="flex items-center justify-between p-2.5 text-xs">
                <div>
                  <span className="font-mono font-bold text-foreground mr-2">{g.code}</span>
                  <span className="text-foreground">{g.name}</span>
                  {hasBatches && (
                    <span className="text-[10px] text-muted-foreground ml-2">({g._count?.batches} 个批次)</span>
                  )}
                </div>
                {!hasBatches && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget({ id: g.id, name: g.name })}
                    disabled={isPending}
                    className="h-6 px-1.5 text-destructive text-xs"
                    title="删除班组"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="确认删除捆扎班组"
        description={`确定要删除班组【${deleteTarget?.name}】吗？\n\n注意：此操作不可撤销。`}
        confirmText="确认删除"
        loading={isPending}
        onConfirm={handleConfirmDelete}
      />
    </Dialog>
  );
}
