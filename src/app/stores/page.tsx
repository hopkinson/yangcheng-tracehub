import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StoreDialog } from "@/components/forms/StoreDialog";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const [stores, channels, defaultUser] = await Promise.all([
    prisma.store.findMany({
      include: {
        channel: true,
        outboundOrders: true,
      },
      orderBy: { code: "asc" },
    }),
    prisma.channel.findMany({ orderBy: { code: "asc" } }),
    prisma.user.findFirstOrThrow({ where: { role: "WAREHOUSE_ADMIN" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">销售门店档案管理</h1>
          <p className="text-sm text-muted-foreground">
            维护各渠道零售门店档案。出库申请时门店从档案选择；已有出库发货记录的门店禁止删除。
          </p>
        </div>
        <StoreDialog channels={channels} userId={defaultUser.id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>门店清单与出库关联台账</CardTitle>
          <CardDescription>
            全量展示各商超零售渠道（山姆、盒马等）线下门店档案。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>门店编号</TableHead>
                  <TableHead>门店全称</TableHead>
                  <TableHead>所属渠道</TableHead>
                  <TableHead>历史出库记录数</TableHead>
                  <TableHead>运营状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      暂无门店档案，请点击右上角新增
                    </TableCell>
                  </TableRow>
                ) : (
                  stores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell className="font-mono font-medium">{store.code}</TableCell>
                      <TableCell className="font-semibold">{store.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{store.channel.name}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {store.outboundOrders.length > 0 ? (
                          <span className="font-medium text-primary">{store.outboundOrders.length} 笔订单</span>
                        ) : (
                          <span className="text-muted-foreground">0 笔</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={store.isActive ? "default" : "secondary"}>
                          {store.isActive ? "正常运营" : "已停用"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <StoreDialog store={store} channels={channels} userId={defaultUser.id} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
