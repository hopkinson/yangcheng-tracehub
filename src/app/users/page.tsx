import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { UserManagementView } from "@/components/users/UserManagementView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Store, CheckSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentUser = await getCurrentUser();

  const [users, channels] = await Promise.all([
    prisma.user.findMany({
      include: {
        channel: true,
        _count: {
          select: {
            createdBatches: true,
            tagClaims: true,
            approvedClaims: true,
            outboundOrders: true,
            approvedOrders: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.channel.findMany({
      orderBy: { code: "asc" },
    }),
  ]);

  const counts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">用户管理</h1>
          <p className="text-xs text-muted-foreground">系统账号维护与角色权限配置</p>
        </div>
      </div>

      {/* 统计指标卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总注册用户</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length} 位</div>
            <p className="text-xs text-muted-foreground">涵盖 5 大系统角色</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">品控与审核主管</CardTitle>
            <CheckSquare className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(counts.QA_DIRECTOR || 0) + (counts.ADMIN || 0)} 位</div>
            <p className="text-xs text-muted-foreground">{counts.QA_DIRECTOR || 0} 位品控 + {counts.ADMIN || 0} 位管理员</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">一线仓储与运营</CardTitle>
            <Shield className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.WAREHOUSE_ADMIN || 0} 位</div>
            <p className="text-xs text-muted-foreground">负责批次入池与打包出库</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">渠道只读审计人员</CardTitle>
            <Store className="size-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.CHANNEL_VIEWER || 0} 位</div>
            <p className="text-xs text-muted-foreground">覆盖 {channels.length} 个合作销售渠道</p>
          </CardContent>
        </Card>
      </div>

      {/* 用户数据主表与操作 */}
      <UserManagementView
        users={users}
        channels={channels}
        currentUserId={currentUser?.id || ""}
      />
    </div>
  );
}
