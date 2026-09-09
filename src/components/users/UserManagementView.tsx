"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserDialog, ROLE_LABELS, type ChannelOption } from "@/components/forms/UserDialog";
import { resetPasswordAction, deleteUserAction } from "@/actions/users";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { formatDate, cn } from "@/lib/utils";
import {
  Search,
  KeyRound,
  Trash2,
  Building2,
  Users,
  Lock,
  MoreHorizontal,
} from "lucide-react";

interface UserItem {
  id: string;
  username: string;
  phone: string;
  fullName: string;
  role: string;
  channelId: string | null;
  channel?: { id: string; name: string; code: string } | null;
  createdAt: Date | string;
  _count?: {
    createdBatches: number;
    tagClaims: number;
    approvedClaims: number;
    outboundOrders: number;
    approvedOrders: number;
  };
}

const ROLE_CONFIG: Record<string, { label: string; className: string; variant?: "outline" | "secondary" }> = {
  ADMIN: { label: "超级管理员", className: "bg-purple-600 hover:bg-purple-700" },
  QA_DIRECTOR: { label: "品控主管", className: "bg-amber-600 hover:bg-amber-700" },
  WAREHOUSE_ADMIN: { label: "仓库管理员", className: "bg-blue-600 hover:bg-blue-700" },
  FARMER_ADMIN: { label: "养殖户管理员", className: "bg-emerald-600 hover:bg-emerald-700" },
  CHANNEL_VIEWER: { label: "渠道审计员", className: "border-cyan-600 text-cyan-600", variant: "outline" },
};

const getRoleBadge = (role: string) => {
  const config = ROLE_CONFIG[role];
  return config ? (
    <Badge variant={config.variant} className={`${config.className} font-medium`}>{config.label}</Badge>
  ) : (
    <Badge variant="secondary">{role}</Badge>
  );
};

export function UserManagementView({
  users,
  channels,
  currentUserId,
}: {
  users: UserItem[];
  channels: ChannelOption[];
  currentUserId: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");

  const filteredUsers = users.filter((u) => {
    const matchQuery =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm)) ||
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = selectedRole === "ALL" || u.role === selectedRole;
    return matchQuery && matchRole;
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmText?: string;
    variant?: "destructive" | "default";
    action: () => Promise<void>;
  }>({
    open: false,
    title: "",
    description: "",
    action: async () => {},
  });
  const [actionLoading, setActionLoading] = useState(false);

  const [passwordTargetUser, setPasswordTargetUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser) return;
    const pwd = newPassword.trim();
    if (!pwd) {
      toast.error("新密码不能为空");
      return;
    }
    if (pwd.length < 6) {
      toast.error("新密码长度不能少于 6 位");
      return;
    }
    setPasswordSubmitting(true);
    try {
      const res = await resetPasswordAction({
        id: passwordTargetUser.id,
        newPassword: pwd,
        operatorId: currentUserId,
      });
      toast.success(`用户 "${passwordTargetUser.fullName}" 登录密码已成功修改为: ${res.newPassword}`);
      setPasswordTargetUser(null);
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message || "修改密码失败");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleDeleteUser = (user: UserItem) => {
    setConfirmDialog({
      open: true,
      title: "确认删除用户",
      description: `确定要删除用户 "${user.fullName}" (${user.username}) 吗？此操作不可撤销。`,
      confirmText: "确认删除",
      variant: "destructive",
      action: async () => {
        await deleteUserAction({ id: user.id, operatorId: currentUserId });
        toast.success(`用户 "${user.fullName}" 已删除`);
      },
    });
  };

  const handleExecuteConfirm = async () => {
    setActionLoading(true);
    try {
      await confirmDialog.action();
      setConfirmDialog((prev) => ({ ...prev, open: false }));
    } catch (err: any) {
      toast.error(err.message || "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="size-5 text-primary" />
                  系统用户列表
                </CardTitle>
              </div>
              <UserDialog channels={channels} operatorId={currentUserId} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="搜索手机号、真实姓名、用户名..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
              <div className="w-full sm:w-[200px]">
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="筛选角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">全部角色 ({users.length})</SelectItem>
                    {Object.entries(ROLE_LABELS).map(([rKey, item]) => (
                      <SelectItem key={rKey} value={rKey} className="text-xs">
                        {item.label.split(" ")[0]} ({users.filter((u) => u.role === rKey).length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">用户姓名 / 手机号</TableHead>
                    <TableHead>系统角色</TableHead>
                    <TableHead>归属销售渠道</TableHead>
                    <TableHead>关联业务记录</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                        未找到符合条件的用户
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const isSelf = user.id === currentUserId;
                      const totalRecords = Object.values(user._count || {}).reduce((s, c) => s + c, 0);

                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-semibold text-xs shrink-0">
                                {user.fullName.slice(0, 1)}
                              </div>
                              <div className="flex flex-col">
                                <div className="font-semibold text-sm flex items-center gap-1.5">
                                  {user.fullName}
                                  {isSelf && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary text-primary">
                                      当前账号
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {user.phone || "-"}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                          <TableCell>
                            {user.channel ? (
                              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                <Building2 className="size-3.5 text-muted-foreground" />
                                {user.channel.name}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {totalRecords > 0 ? `${totalRecords} 条流水` : "无流水"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {formatDate(user.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* 编辑用户 */}
                              <UserDialog
                                user={user}
                                channels={channels}
                                operatorId={currentUserId}
                              />

                              {/* 更多操作下拉菜单 */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-muted-foreground hover:text-foreground"
                                  >
                                    <MoreHorizontal className="size-4" />
                                    <span className="sr-only">更多操作</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36 text-xs">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setPasswordTargetUser(user);
                                      setNewPassword("");
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <KeyRound className="size-3.5 text-primary" />
                                    <span>修改密码</span>
                                  </DropdownMenuItem>

                                  {!isSelf && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteUser(user)}
                                        disabled={totalRecords > 0}
                                        className={cn(
                                          "gap-2 cursor-pointer",
                                          totalRecords > 0
                                            ? "text-muted-foreground opacity-50"
                                            : "text-destructive focus:text-destructive"
                                        )}
                                      >
                                        <Trash2 className="size-3.5" />
                                        <span>{totalRecords > 0 ? "有流水不可删" : "删除用户"}</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>


      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        loading={actionLoading}
        onConfirm={handleExecuteConfirm}
      />

      {/* 管理员修改用户登录密码弹窗 */}
      <Dialog
        open={Boolean(passwordTargetUser)}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTargetUser(null);
            setNewPassword("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <form onSubmit={handleChangePassword}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Lock className="size-4 text-primary" />
                修改用户登录密码
              </DialogTitle>
              <DialogDescription className="text-xs">
                正在为用户 <strong className="text-foreground">{passwordTargetUser?.fullName}</strong> ({passwordTargetUser?.phone || passwordTargetUser?.username}) 设置新的登录密码。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-foreground">新登录密码</label>
                  {passwordTargetUser?.phone && (
                    <button
                      type="button"
                      onClick={() => setNewPassword(passwordTargetUser.phone.slice(-6))}
                      className="text-primary hover:underline text-[11px] cursor-pointer"
                    >
                      填入手机后6位 ({passwordTargetUser.phone.slice(-6)})
                    </button>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder="请输入至少 6 位的新密码"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-9 text-xs font-mono"
                  disabled={passwordSubmitting}
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPasswordTargetUser(null)}
                disabled={passwordSubmitting}
              >
                取消
              </Button>
              <Button type="submit" size="sm" disabled={passwordSubmitting}>
                {passwordSubmitting ? "保存中..." : "确认修改"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
