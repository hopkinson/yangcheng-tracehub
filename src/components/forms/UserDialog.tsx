"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { createUserAction, updateUserAction } from "@/actions/users";
import { userFormSchema, type UserFormValues } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { UserPlus, Pencil, Shield, Store } from "lucide-react";

export const ROLE_LABELS: Record<string, { label: string; desc: string }> = {
  ADMIN: { label: "管理员 (ADMIN)", desc: "系统全功能运维、用户与全局配置、兜底特批" },
  FARMER_ADMIN: { label: "审核员 (FARMER_ADMIN)", desc: "主要管审批：蟹扣领用、出库发货、出库损耗审批（无角色与权限）" },
  WAREHOUSE_ADMIN: { label: "库管员 (WAREHOUSE_ADMIN)", desc: "原料入池、暂养、捆扎分拣、出库发运、损耗盘点（无审批，无角色与权限）" },
  QA_DIRECTOR: { label: "质检员 (QA_DIRECTOR)", desc: "各工序品控质检录入、检测报告上传（无审批，无角色与权限）" },
  CHANNEL_VIEWER: { label: "渠道审计员 (山姆/CHANNEL_VIEWER)", desc: "专属渠道订单追溯与合规台账只读查询" },
};

export interface ChannelOption {
  id: string;
  name: string;
}

interface UserData {
  id?: string;
  username?: string;
  phone?: string;
  fullName?: string;
  role?: string;
  channelId?: string | null;
}

const getUserValues = (user?: UserData): UserFormValues => ({
  username: user?.username || "",
  phone: user?.phone || "",
  fullName: user?.fullName || "",
  role: (user?.role as UserFormValues["role"]) || "WAREHOUSE_ADMIN",
  channelId: user?.channelId || "",
  password: "",
});

export function UserDialog({
  user,
  channels,
  operatorId,
  trigger,
  onSuccess,
}: {
  user?: UserData;
  channels: ChannelOption[];
  operatorId: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(user?.id);

  const defaultValues = useMemo(() => getUserValues(user), [user]);
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) form.reset(getUserValues(user));
  }, [open, user, form]);

  const watchedRole = form.watch("role");

  const onSubmit = async (data: UserFormValues) => {
    setLoading(true);
    try {
      if (isEditing && user?.id) {
        await updateUserAction({
          id: user.id,
          phone: data.phone.trim(),
          fullName: data.fullName.trim(),
          role: data.role,
          channelId: data.role === "CHANNEL_VIEWER" ? data.channelId : undefined,
          operatorId,
        });
        toast.success(`用户 "${data.fullName}" 信息更新成功`);
      } else {
        await createUserAction({
          username: data.username.trim(),
          phone: data.phone.trim(),
          fullName: data.fullName.trim(),
          role: data.role,
          channelId: data.role === "CHANNEL_VIEWER" ? data.channelId : undefined,
          password: data.password || undefined,
          operatorId,
        });
        toast.success(`新用户 "${data.fullName}" (${data.phone.trim()}) 创建成功`);
      }
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : isEditing ? (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
            <Pencil className="size-3.5 mr-1" />
            编辑
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5 shadow-xs">
            <UserPlus className="size-4" />
            新增用户
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="size-5 text-primary" />
                {isEditing ? `编辑用户: ${user?.fullName}` : "新增系统用户"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right text-xs">登录账号</FormLabel>
                    <div className="col-span-3 space-y-1">
                      <FormControl>
                        <Input
                          placeholder="如: zhangsan / sams_auditor"
                          disabled={isEditing || loading}
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      {isEditing && (
                        <FormDescription className="text-[11px]">
                          账号名为主键标识，创建后不可更改
                        </FormDescription>
                      )}
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right text-xs">手机号码</FormLabel>
                    <div className="col-span-3 space-y-1">
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="如: 13800000001"
                          disabled={loading}
                          maxLength={11}
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-[11px]">
                        用于系统登录认证与密码重置 (11位手机号)
                      </FormDescription>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right text-xs">真实姓名</FormLabel>
                    <div className="col-span-3 space-y-1">
                      <FormControl>
                        <Input
                          placeholder="如: 张三 (品控专员)"
                          disabled={loading}
                          className="text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right text-xs">系统角色</FormLabel>
                    <div className="col-span-3 space-y-1">
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={loading}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full text-xs">
                            <SelectValue placeholder="选择业务角色" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([rKey, item]) => (
                            <SelectItem key={rKey} value={rKey} className="text-xs">
                              <div className="flex flex-col">
                                <span className="font-semibold">{item.label}</span>
                                <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              {watchedRole === "CHANNEL_VIEWER" && (
                <FormField
                  control={form.control}
                  name="channelId"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <FormLabel className="text-right text-xs font-semibold text-amber-900 dark:text-amber-300 flex items-center justify-end gap-1">
                        <Store className="size-3.5" />
                        绑定渠道
                      </FormLabel>
                      <div className="col-span-3 space-y-1">
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={loading}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full text-xs bg-background">
                              <SelectValue placeholder="请选择归属的零售渠道" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {channels.map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-[10px] text-amber-700 dark:text-amber-400">
                          渠道人员将受到严格物理隔离，仅可查验该渠道的出库追溯与台账
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              )}

              {!isEditing && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right text-xs">初始密码</FormLabel>
                      <div className="col-span-3 space-y-1">
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="留空则默认为手机号后6位"
                            disabled={loading}
                            className="text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-[11px]">
                          默认初始密码：手机号后6位
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              )}

            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
                取消
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "提交中..." : isEditing ? "保存修改" : "确认创建"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
