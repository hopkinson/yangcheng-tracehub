"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPoolAction, updatePoolAction, deletePoolAction } from "@/actions/pools";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Waves } from "lucide-react";

export function PoolDialog({
  pool,
  userId,
}: {
  pool?: { id: string; code: string; name: string; status: string };
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditing = !!pool;

  const [name, setName] = useState(pool?.name || "");
  const [status, setStatus] = useState(pool?.status || "ACTIVE");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("请输入暂养池名称");
      return;
    }

    setLoading(true);
    try {
      if (isEditing && pool) {
        await updatePoolAction({ id: pool.id, name, status, userId });
        toast.success("暂养池配置已更新！");
      } else {
        await createPoolAction({ name, userId });
        toast.success("新增暂养池成功！");
        setName("");
      }
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!pool || !confirm(`确认删除暂养池【${pool.code} - ${pool.name}】吗？`)) return;
    setLoading(true);
    try {
      await deletePoolAction({ id: pool.id, userId });
      toast.success("暂养池已删除！");
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "删除失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
            <Edit2 className="size-3.5" />
          </Button>
        ) : (
          <Button className="flex items-center gap-2">
            <Plus className="size-4" data-icon="inline-start" />
            新增暂养池
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Waves className="size-5 text-primary" />
            <DialogTitle>{isEditing ? `编辑暂养池 (${pool.code})` : "新增暂养池"}</DialogTitle>
          </div>
          <DialogDescription>
            {isEditing ? "修改池子名称或启停状态；有在养批次的池子禁止删除。" : "系统将自动按 ZY-XX 规则分配池子编号。"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>暂养池名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：1号公蟹池 / 东区暂养池A"
              required
            />
          </div>

          {isEditing && (
            <div className="flex flex-col gap-1.5">
              <Label>使用状态</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">正常在用</SelectItem>
                  <SelectItem value="MAINTENANCE">维护停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {isEditing ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="text-xs gap-1"
                disabled={loading}
                onClick={handleDelete}
              >
                <Trash2 className="size-3.5" />
                删除池子
              </Button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
