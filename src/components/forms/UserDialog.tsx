"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUserAction, updateUserAction } from "@/actions/users";
import { toast } from "sonner";
import { UserPlus, Pencil, Shield, Store } from "lucide-react";

export const ROLE_LABELS: Record<string, { label: string; desc: string }> = {
  ADMIN: { label: "超级管理员 (ADMIN)", desc: "系统运维、用户与全局配置、特批放行" },
  QA_DIRECTOR: { label: "品控主管 (QA_DIRECTOR)", desc: "蟹扣审批、出库审核、异常调查" },
  WAREHOUSE_ADMIN: { label: "仓库管理员 (WAREHOUSE_ADMIN)", desc: "批次入池、盘点损耗、出库打包、物流回填" },
  FARMER_ADMIN: { label: "养殖户管理员 (FARMER_ADMIN)", desc: "养殖户建档、围网维护、额度核定" },
  CHANNEL_VIEWER: { label: "渠道审计员 (CHANNEL_VIEWER)", desc: "专属渠道追溯、四大台账只读查看" },
};

interface ChannelOption {
  id: string;
  name: string;
  code: string;
}

interface UserData {
  id?: string;
  username?: string;
  fullName?: string;
  role?: string;
  channelId?: string | null;
}

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

  const [username, setUsername] = useState(user?.username || "");
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [role, setRole] = useState(user?.role || "WAREHOUSE_ADMIN");
  const [channelId, setChannelId] = useState(user?.channelId || "");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (open) {
      setUsername(user?.username || "");
      setFullName(user?.fullName || "");
      setRole(user?.role || "WAREHOUSE_ADMIN");
      setChannelId(user?.channelId || "");
      setPassword("");
    }
  }, [open, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error("请输入账号用户名");
      return;
    }
    if (!fullName.trim()) {
      toast.error("请输入用户真实姓名");
      return;
    }
    if (role === "CHANNEL_VIEWER" && !channelId) {
      toast.error("渠道审计人员必须绑定所属渠道！");
      return;
    }

    setLoading(true);
    try {
      if (isEditing && user?.id) {
        await updateUserAction({
          id: user.id,
          fullName,
          role,
          channelId: role === "CHANNEL_VIEWER" ? channelId : undefined,
          operatorId,
        });
        toast.success(`用户 "${fullName}" 信息更新成功`);
      } else {
        await createUserAction({
          username,
          fullName,
          role,
          channelId: role === "CHANNEL_VIEWER" ? channelId : undefined,
          password: password || undefined,
          operatorId,
        });
        toast.success(`新用户 "${fullName}" (${username}) 创建成功`);
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
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5 text-primary" />
              {isEditing ? `编辑用户: ${user?.fullName}` : "新增系统用户"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "修改用户的姓名、所属角色或绑定的渠道主体。"
                : "创建新的系统操作账号，并分配对应的业务角色与访问权限。"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right text-xs">
                登录账号
              </Label>
              <div className="col-span-3">
                <Input
                  id="username"
                  placeholder="如: zhangsan / sams_auditor"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isEditing || loading}
                  className="font-mono text-sm"
                  required
                />
                {isEditing && (
                  <p className="text-[11px] text-muted-foreground mt-1">账号名为主键标识，创建后不可更改</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fullName" className="text-right text-xs">
                真实姓名
              </Label>
              <Input
                id="fullName"
                placeholder="如: 张三 (品控专员)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                className="col-span-3 text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right text-xs">
                系统角色
              </Label>
              <div className="col-span-3">
                <Select value={role} onValueChange={setRole} disabled={loading}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="选择业务角色" />
                  </SelectTrigger>
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
              </div>
            </div>

            {/* 仅当选择渠道人员时，动态展示所属渠道选择 */}
            {role === "CHANNEL_VIEWER" && (
              <div className="grid grid-cols-4 items-center gap-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <Label htmlFor="channel" className="text-right text-xs font-semibold text-amber-900 dark:text-amber-300 flex items-center justify-end gap-1">
                  <Store className="size-3.5" />
                  绑定渠道
                </Label>
                <div className="col-span-3">
                  <Select value={channelId} onValueChange={setChannelId} disabled={loading}>
                    <SelectTrigger className="w-full text-xs bg-background">
                      <SelectValue placeholder="请选择归属的零售渠道" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                    渠道人员将受到严格物理隔离，仅可查验该渠道的出库追溯与台账
                  </p>
                </div>
              </div>
            )}

            {!isEditing && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right text-xs">
                  初始密码
                </Label>
                <div className="col-span-3">
                  <Input
                    id="password"
                    type="password"
                    placeholder="留空则默认为 123456"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">默认初始密码：123456</p>
                </div>
              </div>
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
      </DialogContent>
    </Dialog>
  );
}
