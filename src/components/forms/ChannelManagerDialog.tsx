"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createChannelAction, deleteChannelAction } from "@/actions/channels";
import { channelFormSchema, type ChannelFormValues } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { Building2, Plus, Trash2, Loader2 } from "lucide-react";

export interface ChannelItem {
  id: string;
  code: string;
  name: string;
  _count?: {
    stores: number;
    outboundOrders: number;
    users: number;
  };
}

export function ChannelManagerDialog({
  channels,
  userId,
}: {
  channels: ChannelItem[];
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      code: "",
      name: "",
    },
  });

  async function onSubmit(data: ChannelFormValues) {
    setSubmitting(true);
    try {
      await createChannelAction({
        code: data.code.trim(),
        name: data.name.trim(),
        userId,
      });
      toast.success(`销售渠道【${data.name}】创建成功！`);
      form.reset({ code: "", name: "" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "创建渠道失败";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(channel: ChannelItem) {
    const storeCount = channel._count?.stores ?? 0;
    const orderCount = channel._count?.outboundOrders ?? 0;
    const userCount = channel._count?.users ?? 0;

    if (storeCount > 0 || orderCount > 0 || userCount > 0) {
      toast.error(
        `该渠道已关联 ${storeCount} 家门店、${orderCount} 笔订单、${userCount} 个账号，禁止删除！`
      );
      return;
    }

    if (!confirm(`确定要删除渠道【${channel.name} (${channel.code})】吗？`)) return;

    setDeletingId(channel.id);
    try {
      await deleteChannelAction({ id: channel.id, userId });
      toast.success("渠道删除成功！");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "删除失败";
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Building2 className="size-4" data-icon="inline-start" />
          渠道管理 ({channels.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            <DialogTitle>销售渠道管理</DialogTitle>
          </div>
        </DialogHeader>

        {/* 快速新增渠道表单 */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
            <Plus className="size-4 text-primary" />
            新增合作销售渠道
          </h4>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem className="w-full sm:w-1/3 space-y-1">
                    <FormLabel className="text-xs">渠道编码</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="如 SAMS, HEMA"
                        className="h-9 uppercase font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="w-full sm:w-1/2 space-y-1">
                    <FormLabel className="text-xs">渠道全称</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="如 商超零售渠道、餐饮连锁渠道"
                        className="h-9 text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <Button type="submit" size="sm" className="h-9 w-full sm:w-auto mt-2 sm:mt-0" disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4 mr-1" />}
                添加渠道
              </Button>
            </form>
          </Form>
        </div>

        {/* 已有渠道列表 */}
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[120px]">渠道编码</TableHead>
                <TableHead>渠道全称</TableHead>
                <TableHead className="w-[110px] text-center">关联门店数</TableHead>
                <TableHead className="w-[80px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                    暂无销售渠道，请在上方录入创建
                  </TableCell>
                </TableRow>
              ) : (
                channels.map((channel) => {
                  const storeCount = channel._count?.stores ?? 0;
                  const isBusy = deletingId === channel.id;
                  return (
                    <TableRow key={channel.id}>
                      <TableCell className="font-mono font-medium text-xs">
                        <Badge variant="outline">{channel.code}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {channel.name}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {storeCount > 0 ? (
                          <Badge variant="secondary">{storeCount} 家</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          disabled={isBusy}
                          onClick={() => handleDelete(channel)}
                          title="删除渠道"
                        >
                          {isBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
