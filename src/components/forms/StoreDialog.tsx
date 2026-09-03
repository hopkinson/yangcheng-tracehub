"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { createStoreAction, updateStoreAction, deleteStoreAction } from "@/actions/stores";
import { storeFormSchema, type StoreFormValues } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Store as StoreIcon } from "lucide-react";

interface StoreData {
  id: string;
  code: string;
  name: string;
  channelId: string;
  isActive: boolean;
  hasOutboundOrders?: boolean;
}

const getStoreValues = (store?: StoreData, firstChannelId = ""): StoreFormValues => ({
  name: store?.name || "",
  channelId: store?.channelId || firstChannelId,
  isActive: store?.isActive ?? true,
});

export function StoreDialog({
  store,
  channels,
  userId,
}: {
  store?: StoreData;
  channels: Array<{ id: string; name: string; code: string }>;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditing = !!store;

  const defaultValues = useMemo(() => getStoreValues(store, channels[0]?.id), [store, channels]);
  const form = useForm<StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) form.reset(getStoreValues(store, channels[0]?.id));
  }, [open, store, channels, form]);

  async function onSubmit(data: StoreFormValues) {
    setLoading(true);
    try {
      if (isEditing && store) {
        await updateStoreAction({
          id: store.id,
          name: data.name.trim(),
          channelId: data.channelId,
          isActive: data.isActive,
          userId,
        });
        toast.success("门店档案已更新！");
      } else {
        await createStoreAction({
          name: data.name.trim(),
          channelId: data.channelId,
          userId,
        });
        toast.success("新增门店档案成功！");
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
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <StoreIcon className="size-5 text-primary" />
            <DialogTitle>{isEditing ? `编辑门店档案 (${store.code})` : "新增销售门店档案"}</DialogTitle>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>门店全称</FormLabel>
                  <FormControl>
                    <Input placeholder="如：合作门店(苏州邻瑞广场店)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="channelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>所属渠道</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={channels.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={channels.length === 0 ? "暂无可用渠道，请先创建渠道" : "选择所属渠道"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {channels.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {channels.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      系统暂无销售渠道，请点击页面右上角【渠道管理】先录入渠道。
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEditing && (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>运营状态</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === "ACTIVE")}
                      value={field.value ? "ACTIVE" : "INACTIVE"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ACTIVE">正常运营</SelectItem>
                        <SelectItem value="INACTIVE">停用/关闭</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex items-center justify-between pt-2">
              {isEditing ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="text-xs gap-1"
                  disabled={loading || store?.hasOutboundOrders}
                  onClick={handleDelete}
                  title={store?.hasOutboundOrders ? "已有出库记录的门店不可删除，可设为停用" : "删除门店"}
                >
                  <Trash2 className="size-3.5" />
                  {store?.hasOutboundOrders ? "禁止删除(有出库记录)" : "删除门店"}
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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
