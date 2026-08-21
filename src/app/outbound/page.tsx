import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OutboundOrderDialog } from "@/components/forms/OutboundOrderDialog";
import { LogisticsBackfillDialog } from "@/components/forms/LogisticsBackfillDialog";
import { ResubmitOutboundDialog } from "@/components/forms/ResubmitOutboundDialog";

export const dynamic = "force-dynamic";

export default async function OutboundPage() {
  const [orders, batches, stores, defaultUser] = await Promise.all([
    prisma.outboundOrder.findMany({
      include: {
        batch: { include: { farmer: true, pool: true } },
        store: { include: { channel: true } },
        channel: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.batch.findMany({
      where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } },
      include: { farmer: true, pool: true },
    }),
    prisma.store.findMany({
      where: { isActive: true },
      include: { channel: true },
    }),
    prisma.user.findFirstOrThrow({ where: { role: "WAREHOUSE_ADMIN" } }),
  ]);

  const batchOptions = batches.map((b) => ({
    id: b.id,
    code: b.code,
    gender: b.gender,
    weightTier: b.weightTier,
    farmer: { name: b.farmer.name },
    pool: { code: b.pool.code },
    liveInPool: b.inPoolCount - b.outPoolCount - b.lossCount,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">出库单与发运管理 (打包绑扣)</h1>
          <p className="text-sm text-muted-foreground">
            绑扣动作在出库打包时进行：按批次来源养殖户领扣，边打包边绑，扣随货走。单票出库数必须严格等于渠道订单数。
          </p>
        </div>
        <OutboundOrderDialog batches={batchOptions} stores={stores} userId={defaultUser.id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>出库发运记录与物流状态</CardTitle>
          <CardDescription>
            出库完成时若物流单号尚未生成允许置为待生成，确定后在出库单上回填留痕。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>出库单号</TableHead>
                  <TableHead>来源批次</TableHead>
                  <TableHead>来源养殖户</TableHead>
                  <TableHead>暂养池</TableHead>
                  <TableHead>出库数量</TableHead>
                  <TableHead>渠道订单数</TableHead>
                  <TableHead>目标门店</TableHead>
                  <TableHead>所属渠道</TableHead>
                  <TableHead>物流单号</TableHead>
                  <TableHead>审核状态</TableHead>
                  <TableHead className="text-right">物流操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium">{order.code}</TableCell>
                    <TableCell className="font-mono text-xs">{order.batch.code}</TableCell>
                    <TableCell className="font-medium">{order.batch.farmer.name}</TableCell>
                    <TableCell className="font-mono">{order.batch.pool.code}</TableCell>
                    <TableCell className="font-mono font-bold text-primary">
                      {order.outboundCount.toLocaleString()} 只
                    </TableCell>
                    <TableCell className="font-mono">{order.channelOrderCount.toLocaleString()} 只</TableCell>
                    <TableCell>{order.store.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{order.channel.name}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {order.logisticsNo === "待生成" ? (
                        <span className="text-muted-foreground italic">待生成</span>
                      ) : (
                        <span className="font-semibold">{order.logisticsNo}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.status === "APPROVED"
                            ? "default"
                            : order.status === "REJECTED"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {order.status === "APPROVED"
                          ? "已出库"
                          : order.status === "REJECTED"
                          ? "已驳回"
                          : "待审核"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {order.status === "APPROVED" && (
                        <LogisticsBackfillDialog
                          order={order}
                          userId={defaultUser.id}
                          userName={defaultUser.fullName}
                        />
                      )}
                      {order.status === "REJECTED" && (
                        <ResubmitOutboundDialog
                          order={order}
                          stores={stores}
                          userId={defaultUser.id}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
