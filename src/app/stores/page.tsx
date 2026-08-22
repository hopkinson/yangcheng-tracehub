import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StoreDialog } from "@/components/forms/StoreDialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export const dynamic = "force-dynamic";

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 10);

  const [currentUser, totalStores, stores, channels] = await Promise.all([
    getCurrentUser(),
    prisma.store.count(),
    prisma.store.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        channel: true,
        outboundOrders: true,
      },
      orderBy: { code: "asc" },
    }),
    prisma.channel.findMany({ orderBy: { code: "asc" } }),
  ]);

  const currentUserId = currentUser?.id || "";
  const isWarehouseOrAdmin = currentUser?.role === "WAREHOUSE_ADMIN" || currentUser?.role === "ADMIN";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">门店档案</h1>
          <p className="text-xs text-muted-foreground">销售渠道与零售门店信息维护</p>
        </div>
        {isWarehouseOrAdmin && <StoreDialog channels={channels} userId={currentUserId} />}
      </div>

      <Card>
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
                        {isWarehouseOrAdmin && (
                          <StoreDialog store={store} channels={channels} userId={currentUserId} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination total={totalStores} page={page} pageSize={pageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
