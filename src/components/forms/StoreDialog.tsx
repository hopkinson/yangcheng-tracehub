"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createStoreAction, updateStoreAction, deleteStoreAction } from "@/actions/stores";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Store as StoreIcon } from "lucide-react";

export function StoreDialog({
  store,
  channels,
  userId,
}: {
  store?: { id: string; code: string; name: string; channelId: string; isActive: boolean };
  channels: Array<{ id: string; name: string; code: string }>;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditing = !!store;

  const [name, setName] = useState(store?.name || "");
  const [channelId, setChannelId] = useState(store?.channelId || channels[0]?.id || "");
  const [isActive, setIsActive] = useState(store?.isActive ?? true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("请输入门店全称");
      return;
    }

    setLoading(true);
    try {
      if (isEditing && store) {
        await updateStoreAction({ id: store.id, name, channelId, isActive, userId });
        toast.success("门店档案已更新！");
      } else {
        await createStoreAction({ name, channelId, userId });
        toast.success("新增门店档案成功！");
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
    if (!store || !confirm(`确认删除门店【${store.code} - ${store.name}】吗？`)) return;
    setLoading(true);
    try {
      await deleteStoreAction({ id: store.id, userId });
      toast.success("门店已删除！");
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
            新增门店档案
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <StoreIcon className="size-5 text-primary" />
            <DialogTitle>{isEditing ? `编辑门店档案 (${store.code})` : "新增销售门店档案"}</DialogTitle>
          </div>
          <DialogDescription>
            {isEditing ? "修改门店名称或所属渠道；已有出库记录的门店禁止删除。" : "系统将自动按 ST-XX 规则分配门店编号。"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>门店全称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：山姆会员店(苏州邻瑞广场店)"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>所属渠道</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger>
                <SelectValue placeholder="选择所属渠道" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEditing && (
            <div className="flex flex-col gap-1.5">
              <Label>运营状态</Label>
              <Select value={isActive ? "ACTIVE" : "INACTIVE"} onValueChange={(val) => setIsActive(val === "ACTIVE")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">正常运营</SelectItem>
                  <SelectItem value="INACTIVE">停用/关闭</SelectItem>
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
                删除门店
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
