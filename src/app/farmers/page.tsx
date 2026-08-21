import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FarmerDialog } from "@/components/forms/FarmerDialog";
import { Scale, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FarmersPage() {
  const [farmers, defaultUser] = await Promise.all([
    prisma.farmer.findMany({
      include: {
        enclosures: true,
        batches: true,
      },
      orderBy: { code: "asc" },
    }),
    prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">养殖户档案与核定额度管理</h1>
          <p className="text-sm text-muted-foreground">
            额度核定规则：蟹扣额度 = 养殖面积（亩） × 600 只/亩，按自然年度核定，作为全年入池与领扣的双重硬上限。
          </p>
        </div>
        <FarmerDialog userId={defaultUser.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">签约养殖户总数</CardTitle>
            <Scale className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{farmers.length} 户</div>
            <p className="text-xs text-muted-foreground">正常合作中</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总核定养殖面积</CardTitle>
            <MapPin className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {farmers.reduce((sum, f) => sum + f.area, 0).toFixed(1)} 亩
            </div>
            <p className="text-xs text-muted-foreground">签约水域面积</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">全年核定总额度</CardTitle>
            <Scale className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {farmers.reduce((sum, f) => sum + f.quota, 0).toLocaleString()} 只
            </div>
            <p className="text-xs text-muted-foreground">标准产能 600 只/亩</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>养殖户主档与额度使用台账</CardTitle>
          <CardDescription>
            养殖户编号即蟹扣印制编码（JD-年份-序号），一户一码。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>养殖户编号</TableHead>
                  <TableHead>养殖户名称</TableHead>
                  <TableHead>联系电话</TableHead>
                  <TableHead>养殖类型</TableHead>
                  <TableHead>养殖面积</TableHead>
                  <TableHead>年度额度</TableHead>
                  <TableHead>当年累计入池</TableHead>
                  <TableHead>剩余可用额度</TableHead>
                  <TableHead>下属围网</TableHead>
                  <TableHead>信用评级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {farmers.map((farmer) => {
                  const cumulativeInPool = farmer.batches.reduce((sum, b) => sum + b.inPoolCount, 0);
                  const remainingQuota = Math.max(0, farmer.quota - cumulativeInPool);
                  const usageRate = farmer.quota > 0 ? ((cumulativeInPool / farmer.quota) * 100).toFixed(1) : 0;

                  return (
                    <TableRow key={farmer.id}>
                      <TableCell className="font-mono font-medium">{farmer.code}</TableCell>
                      <TableCell className="font-semibold">{farmer.name}</TableCell>
                      <TableCell className="text-muted-foreground">{farmer.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {farmer.farmType === "LAKE_CRAB" ? "湖蟹 (围网)" : "塘蟹"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{farmer.area} 亩</TableCell>
                      <TableCell className="font-mono font-bold text-primary">
                        {farmer.quota.toLocaleString()} 只
                      </TableCell>
                      <TableCell className="font-mono">
                        {cumulativeInPool.toLocaleString()} 只 ({usageRate}%)
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-emerald-600">
                        {remainingQuota.toLocaleString()} 只
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {farmer.enclosures.map((e) => (
                            <Badge key={e.id} variant="secondary" className="text-xs">
                              {e.code}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={farmer.creditRating === "A" ? "default" : "secondary"}>
                          {farmer.creditRating} 级
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={farmer.status === "ACTIVE" ? "outline" : "destructive"}>
                          {farmer.status === "ACTIVE" ? "正常合作" : "暂停"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <FarmerDialog farmer={farmer} userId={defaultUser.id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
