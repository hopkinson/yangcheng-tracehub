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
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">角色与权限</h1>
        </div>
      </div>

      {/* 统计指标卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/80">
          <CardHeader className="p-3 pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">总注册用户</CardTitle>
            <Users className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold font-mono">{users.length} 位</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">涵盖 5 大系统角色</p>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="p-3 pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">品控与审核主管</CardTitle>
            <CheckSquare className="size-3.5 text-amber-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold font-mono">{(counts.QA_DIRECTOR || 0) + (counts.ADMIN || 0)} 位</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{counts.QA_DIRECTOR || 0} 品控 + {counts.ADMIN || 0} 管理员</p>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="p-3 pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">一线仓储与运营</CardTitle>
            <Shield className="size-3.5 text-blue-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold font-mono">{counts.WAREHOUSE_ADMIN || 0} 位</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">负责批次入池与打包出库</p>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="p-3 pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">渠道只读审计人员</CardTitle>
            <Store className="size-3.5 text-cyan-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold font-mono">{counts.CHANNEL_VIEWER || 0} 位</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">覆盖 {channels.length} 个合作销售渠道</p>
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
