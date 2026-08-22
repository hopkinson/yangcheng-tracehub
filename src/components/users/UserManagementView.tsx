"use client";

import { useState, useTransition } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserDialog, ROLE_LABELS } from "@/components/forms/UserDialog";
import { resetPasswordAction, deleteUserAction } from "@/actions/users";
import { switchUserAction } from "@/actions/auth";
import { toast } from "sonner";
import {
  Search,
  KeyRound,
  Trash2,
  LogIn,
  Building2,
  Users,
} from "lucide-react";

interface Channel {
  id: string;
  name: string;
  code: string;
}

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

export function UserManagementView({
  users,
  channels,
  currentUserId,
}: {
  users: UserItem[];
  channels: Channel[];
  currentUserId: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [isPending, startTransition] = useTransition();

  // 筛选用户
  const filteredUsers = users.filter((u) => {
    const matchQuery =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm)) ||
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = selectedRole === "ALL" || u.role === selectedRole;
    return matchQuery && matchRole;
  });

  const handleResetPassword = async (user: UserItem) => {
    const expectedReset = user.phone ? user.phone.slice(-6) : "123456";
    if (!confirm(`确认将用户 "${user.fullName}" (${user.phone || user.username}) 的密码重置为手机后6位 "${expectedReset}" 吗？`)) {
      return;
    }
    try {
      const res = await resetPasswordAction({ id: user.id, operatorId: currentUserId });
      toast.success(`用户 "${user.fullName}" 密码已重置为: ${res.newPassword}`);
    } catch (err: any) {
      toast.error(err.message || "重置密码失败");
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (!confirm(`确定要删除用户 "${user.fullName}" (${user.username}) 吗？`)) {
      return;
    }
    try {
      await deleteUserAction({ id: user.id, operatorId: currentUserId });
      toast.success(`用户 "${user.fullName}" 已删除`);
    } catch (err: any) {
      toast.error(err.message || "删除失败");
    }
  };

  const handleSwitchUser = (userId: string, userName: string) => {
    startTransition(async () => {
      await switchUserAction(userId);
      toast.success(`已切换至用户身份: ${userName}`);
      window.location.href = "/";
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Badge className="bg-purple-600 hover:bg-purple-700 font-medium">超级管理员</Badge>;
      case "QA_DIRECTOR":
        return <Badge className="bg-amber-600 hover:bg-amber-700 font-medium">品控主管</Badge>;
      case "WAREHOUSE_ADMIN":
        return <Badge className="bg-blue-600 hover:bg-blue-700 font-medium">仓库管理员</Badge>;
      case "FARMER_ADMIN":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 font-medium">养殖户管理员</Badge>;
      case "CHANNEL_VIEWER":
        return <Badge variant="outline" className="border-cyan-600 text-cyan-600 font-medium">渠道审计员</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 顶部工具栏与筛选 */}
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
                    const batchCount = user._count?.createdBatches || 0;
                    const claimCount = (user._count?.tagClaims || 0) + (user._count?.approvedClaims || 0);
                    const orderCount = (user._count?.outboundOrders || 0) + (user._count?.approvedOrders || 0);
                    const totalRecords = batchCount + claimCount + orderCount;

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
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                                <span>{user.phone || "-"}</span>
                                <span className="text-[10px] text-muted-foreground/60">(@{user.username})</span>
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
                          {totalRecords > 0 ? (
                            <span className="text-xs font-mono text-muted-foreground">
                              {totalRecords} 条流水
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">无流水</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* 编辑用户 */}
                            <UserDialog
                              user={{
                                id: user.id,
                                username: user.username,
                                phone: user.phone,
                                fullName: user.fullName,
                                role: user.role,
                                channelId: user.channelId,
                              }}
                              channels={channels}
                              operatorId={currentUserId}
                            />

                            {/* 快捷切换身份体验 */}
                            {!isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => handleSwitchUser(user.id, user.fullName)}
                                disabled={isPending}
                                title="切换至该用户身份"
                              >
                                <LogIn className="size-3.5 mr-1" />
                                切换身份
                              </Button>
                            )}

                            {/* 重置密码 */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-muted-foreground hover:text-amber-600"
                              onClick={() => handleResetPassword(user)}
                              title={`重置初始密码为手机后6位 (${user.phone ? user.phone.slice(-6) : "123456"})`}
                            >
                              <KeyRound className="size-3.5 mr-1" />
                              重置密码
                            </Button>

                            {/* 删除用户 */}
                            {!isSelf && totalRecords === 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteUser(user)}
                                title="删除用户"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
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

    </div>
  );
}
