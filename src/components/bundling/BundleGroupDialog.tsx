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
import { Users, Plus, Trash2, Loader2, Pencil, Check, X } from "lucide-react";
import { createBundleGroupAction, deleteBundleGroupAction, updateBundleGroupAction } from "@/actions/production";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function BundleGroupDialog({
  groups,
}: {
  groups: Array<{ id: string; code: string; name: string; _count?: { batches: number } }>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("班组名称不能为空");
      return;
    }

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

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = (id: string, originalName: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast.error("班组名称不能为空");
      return;
    }
    if (trimmed === originalName) {
      setEditingId(null);
      return;
    }

    startTransition(async () => {
      const res = await updateBundleGroupAction(id, trimmed);
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
            const isEditing = editingId === g.id;

            return (
              <div key={g.id} className="flex items-center justify-between p-2.5 text-xs">
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <span className="font-mono font-bold text-foreground shrink-0">{g.code}</span>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveEdit(g.id, g.name);
                        } else if (e.key === "Escape") {
                          handleCancelEdit();
                        }
                      }}
                      autoFocus
                      disabled={isPending}
                      className="h-7 text-xs flex-1"
                    />
                  </div>
                ) : (
                  <div className="flex items-center truncate mr-2">
                    <span className="font-mono font-bold text-foreground mr-2 shrink-0">{g.code}</span>
                    <span className="text-foreground truncate">{g.name}</span>
                    {hasBatches && (
                      <span className="text-[10px] text-muted-foreground ml-2 shrink-0">({g._count?.batches} 个批次)</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSaveEdit(g.id, g.name)}
                        disabled={isPending || !editingName.trim()}
                        className="h-6 px-1.5 text-primary text-xs"
                        title="保存"
                      >
                        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                        disabled={isPending}
                        className="h-6 px-1.5 text-muted-foreground hover:text-foreground text-xs"
                        title="取消"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(g.id, g.name)}
                        disabled={isPending}
                        className="h-6 px-1.5 text-muted-foreground hover:text-foreground text-xs"
                        title="编辑名称"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
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
                    </>
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
        title="确认删除捆扎班组"
        description={`确定要删除班组【${deleteTarget?.name}】吗？\n\n注意：此操作不可撤销。`}
        confirmText="确认删除"
        loading={isPending}
        onConfirm={handleConfirmDelete}
      />
    </Dialog>
  );
}
