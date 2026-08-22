"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { createPoolAction, updatePoolAction, deletePoolAction } from "@/actions/pools";
import { poolFormSchema, type PoolFormValues } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Waves } from "lucide-react";

interface PoolData {
  id: string;
  code: string;
  name: string;
}

const getPoolValues = (pool?: PoolData): PoolFormValues => ({
  name: pool?.name || "",
});

export function PoolDialog({
  pool,
  userId,
}: {
  pool?: PoolData;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditing = !!pool;

  const defaultValues = useMemo(() => getPoolValues(pool), [pool]);
  const form = useForm<PoolFormValues>({
    resolver: zodResolver(poolFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) form.reset(getPoolValues(pool));
  }, [open, pool, form]);

  async function onSubmit(data: PoolFormValues) {
    setLoading(true);
    try {
      if (isEditing && pool) {
        await updatePoolAction({ id: pool.id, name: data.name.trim(), userId });
        toast.success("暂养池配置已更新！");
      } else {
        await createPoolAction({ name: data.name.trim(), userId });
        toast.success("新增暂养池成功！");
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
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Waves className="size-5 text-primary" />
            <DialogTitle>{isEditing ? `编辑暂养池 (${pool.code})` : "新增暂养池"}</DialogTitle>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>暂养池名称</FormLabel>
                  <FormControl>
                    <Input placeholder="如：1号公蟹池 / 东区暂养池A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
