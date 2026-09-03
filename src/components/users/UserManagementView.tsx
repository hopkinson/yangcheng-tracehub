"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserDialog, ROLE_LABELS } from "@/components/forms/UserDialog";
import { resetPasswordAction, deleteUserAction } from "@/actions/users";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  Search,
  KeyRound,
  Trash2,
  Building2,
  Users,
  ShieldCheck,
  Check,
  Minus,
  Lock,
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

const PERMISSION_MATRIX = [
  { category: "源头准入与建档", module: "养殖户主档与额度管理", desc: "签约建档、围网维护、额度动态核定 (600只/亩)、合同附件归档", admin: "管理 / 特批", farmerAdmin: "建档 / 编辑", warehouse: "只读查验", qa: "只读审计", channel: "无权访问" },
  { category: "生产仓储与暂养", module: "原料批次入池登记", desc: "到厂入库登记、公母规格锁定、防混池校验、超额特批", admin: "特批放行", farmerAdmin: "只读", warehouse: "入池登记", qa: "在养监控", channel: "反向溯源" },
  { category: "生产仓储与暂养", module: "暂养池监控与管理", desc: "池位规格状态查看、防混池规则卡控、有活蟹防删保护", admin: "配置 / 清空", farmerAdmin: "无权", warehouse: "池位操作", qa: "规格监控", channel: "无权" },
  { category: "加工与预冷", module: "捆扎管理与分拣称重", desc: "捆扎班组排产、蟹绳批次记录、分拣机合格率统计与损耗核算", admin: "全局监控", farmerAdmin: "无权", warehouse: "任务录入", qa: "分拣抽查", channel: "无权" },
  { category: "领扣与日结", module: "蟹扣申领与日清日结", desc: "按池余量申请领扣、绑扣出库核销、退回/作废轧平", admin: "全局监控", farmerAdmin: "查看归集", warehouse: "申请 / 轧平", qa: "无权", channel: "无权" },
  { category: "品控审批与风控", module: "蟹扣领用合规审批", desc: "核验在池活蟹数量与年度余量，审批通过方可发扣", admin: "终审放行", farmerAdmin: "无权", warehouse: "发起申请", qa: "合规审批", channel: "无权" },
  { category: "品控审批与风控", module: "损耗盘点与 >5% 预警", desc: "实盘数量登记、禁止负损耗；损耗率 >5% 强制必填原因并标红告警", admin: "处置终审", farmerAdmin: "无权", warehouse: "实盘登记", qa: "异常调查", channel: "无权" },
  { category: "出库与履约", module: "出库打包与物流回填", desc: "单票出库打包、按批次绑扣、填报物流单号/门店自配", admin: "管理", farmerAdmin: "无权", warehouse: "打包 / 发货", qa: "出库核准", channel: "进度查验" },
  { category: "品控审批与风控", module: "出库单审核与三方一致性", desc: "校验在池存活、单票一致（出库数=订单数），审批通过即核销在池", admin: "特批放行", farmerAdmin: "无权", warehouse: "提交申请", qa: "出库审批", channel: "无权" },
  { category: "品控审批与风控", module: "批次品控争议冻结 / 解冻", desc: "抽检不合格或重大损耗时冻结批次，禁止出库发货；排查后解冻", admin: "冻结 / 解冻", farmerAdmin: "无权", warehouse: "受控拦截", qa: "冻结 / 解冻", channel: "无权" },
  { category: "销售与溯源", module: "门店档案与渠道管理", desc: "各渠道门店主档维护、累计出库统计、有出库记录防删保护", admin: "增删改查", farmerAdmin: "无权", warehouse: "门店维护", qa: "只读", channel: "只读" },
  { category: "销售与溯源", module: "渠道反向追溯与合规台账", desc: "四本法定合规台账查阅、批次全链路正反向追溯、快检试吃原件调阅", admin: "全量调阅", farmerAdmin: "养殖台账", warehouse: "出入库台账", qa: "全量调阅", channel: "专属追溯 (隔离)" },
  { category: "系统与安全", module: "系统用户与特批审计", desc: "用户账号管理、初始密码重置、全流程特批放行与操作留痕审计", admin: "超级特权", farmerAdmin: "无权", warehouse: "无权", qa: "无权", channel: "无权" },
];

const BADGE_COLOR_MAP: Array<[RegExp, string]> = [
  [/特批|特权|超级/, "border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10"],
  [/审批|调查|冻结/, "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"],
  [/登记|打包|申请|建档/, "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10"],
];

const getPermissionBadge = (val: string) => {
  if (val.startsWith("无权")) return <span className="text-xs text-muted-foreground/50">-</span>;
  if (/追溯|只读|调阅/.test(val)) return <Badge variant="secondary" className="text-[11px] font-normal text-muted-foreground">{val}</Badge>;
  const match = BADGE_COLOR_MAP.find(([re]) => re.test(val));
  return (
    <Badge variant="outline" className={`${match ? match[1] : ""} text-[11px] font-normal`}>
      {val}
    </Badge>
  );
};

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
    if (!confirm(`确认将用户 "${user.fullName}" (${user.phone || user.username}) 的密码重置为手机后6位 "${expectedReset}" 吗？`)) return;
    try {
      const res = await resetPasswordAction({ id: user.id, operatorId: currentUserId });
      toast.success(`用户 "${user.fullName}" 密码已重置为: ${res.newPassword}`);
    } catch (err: any) {
      toast.error(err.message || "重置密码失败");
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (!confirm(`确定要删除用户 "${user.fullName}" (${user.username}) 吗？`)) return;
    try {
      await deleteUserAction({ id: user.id, operatorId: currentUserId });
      toast.success(`用户 "${user.fullName}" 已删除`);
    } catch (err: any) {
      toast.error(err.message || "删除失败");
    }
  };

  return (
    <Tabs defaultValue="users" className="flex flex-col gap-4">
      <TabsList className="w-fit">
        <TabsTrigger value="users" className="flex items-center gap-1.5 text-xs">
          <Users className="size-3.5" />
          系统用户管理 ({users.length})
        </TabsTrigger>
        <TabsTrigger value="matrix" className="flex items-center gap-1.5 text-xs">
          <ShieldCheck className="size-3.5 text-primary" />
          四角色权限矩阵 (RBAC)
        </TabsTrigger>
      </TabsList>

      {/* 选项卡 1：用户列表 */}
      <TabsContent value="users" className="mt-0">
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
                            {formatDate(user.createdAt)}
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
      </TabsContent>

      {/* 选项卡 2：四角色权限矩阵 */}
      <TabsContent value="matrix" className="mt-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              系统四角色职责与权限矩阵 (RBAC)
            </CardTitle>
            <CardDescription className="text-xs">
              根据业务规范第 2 节与第 5 节，系统划定明确的职责隔离与制衡约束，确保全链路数据真实与合规证明有效。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[180px]">业务功能模块</TableHead>
                    <TableHead className="w-[260px]">功能与校验职责</TableHead>
                    <TableHead className="min-w-[110px]">
                      <div className="flex flex-col">
                        <span className="font-semibold text-purple-600 dark:text-purple-400">超级管理员</span>
                        <span className="text-[10px] text-muted-foreground font-mono">ADMIN</span>
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[110px]">
                      <div className="flex flex-col">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">养殖户管理员</span>
                        <span className="text-[10px] text-muted-foreground font-mono">FARMER_ADMIN</span>
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[110px]">
                      <div className="flex flex-col">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">仓库管理员</span>
                        <span className="text-[10px] text-muted-foreground font-mono">WAREHOUSE_ADMIN</span>
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[110px]">
                      <div className="flex flex-col">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">品控主管</span>
                        <span className="text-[10px] text-muted-foreground font-mono">QA_DIRECTOR</span>
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[110px]">
                      <div className="flex flex-col">
                        <span className="font-semibold text-cyan-600 dark:text-cyan-400">渠道审计员</span>
                        <span className="text-[10px] text-muted-foreground font-mono">CHANNEL_VIEWER</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PERMISSION_MATRIX.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-xs">
                        <span className="font-semibold text-foreground">{item.module}</span>
                        <div className="text-[10px] text-muted-foreground">{item.category}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.desc}
                      </TableCell>
                      <TableCell>{getPermissionBadge(item.admin)}</TableCell>
                      <TableCell>{getPermissionBadge(item.farmerAdmin)}</TableCell>
                      <TableCell>{getPermissionBadge(item.warehouse)}</TableCell>
                      <TableCell>{getPermissionBadge(item.qa)}</TableCell>
                      <TableCell>{getPermissionBadge(item.channel)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
