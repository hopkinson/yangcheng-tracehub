import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BatchIntakeDialog } from "@/components/forms/BatchIntakeDialog";
import { LossRegisterDialog } from "@/components/forms/LossRegisterDialog";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const [batches, farmers, pools, defaultUser] = await Promise.all([
    prisma.batch.findMany({
      include: {
        farmer: true,
        enclosure: true,
        pool: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.farmer.findMany({
      include: { enclosures: true },
      where: { status: "ACTIVE" },
    }),
    prisma.holdingPool.findMany({
      where: { status: "ACTIVE" },
    }),
    prisma.user.findFirstOrThrow({
      where: { role: "WAREHOUSE_ADMIN" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">活蟹原料批次管理 (入池台账)</h1>
          <p className="text-sm text-muted-foreground">
            入库即入池，一批一公母一规格。账面在池 = 入池数 − 已出池数 − 已登记损耗。
          </p>
        </div>
        <BatchIntakeDialog farmers={farmers} pools={pools} userId={defaultUser.id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>全量原料批次明细与在池存活状态</CardTitle>
          <CardDescription>
            原料批次为内部追溯管理对象，蟹扣印制养殖户码，出库打包时按批次来源养殖户领扣绑扣。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>批次编号</TableHead>
                  <TableHead>来源养殖户</TableHead>
                  <TableHead>围网</TableHead>
                  <TableHead>暂养池</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead>初始入池</TableHead>
                  <TableHead>已出库数</TableHead>
                  <TableHead>累计损耗</TableHead>
                  <TableHead>当前账面在池</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => {
                  const liveInPool = batch.inPoolCount - batch.outPoolCount - batch.lossCount;
                  const lossRate = batch.inPoolCount > 0 ? ((batch.lossCount / batch.inPoolCount) * 100).toFixed(1) : 0;

                  return (
                    <TableRow key={batch.id}>
                      <TableCell className="font-mono font-medium">{batch.code}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{batch.farmer.name}</span>
                          <span className="text-xs font-mono text-muted-foreground">{batch.farmer.code}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{batch.enclosure.code}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {batch.pool.code}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {batch.gender === "MALE" ? "公" : "母"} · {batch.weightTier}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{batch.inPoolCount} 只</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{batch.outPoolCount} 只</TableCell>
                      <TableCell>
                        <span className={Number(lossRate) > 5.0 ? "font-bold text-destructive font-mono flex items-center gap-1" : "font-mono"}>
                          {batch.lossCount} 只 ({lossRate}%)
                          {Number(lossRate) > 5.0 && <AlertTriangle className="size-3 text-destructive" />}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-emerald-600 text-base">
                        {liveInPool} 只
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            batch.status === "COMPLETED"
                              ? "outline"
                              : batch.status === "FROZEN"
                              ? "destructive"
                              : "default"
                          }
                        >
                          {batch.status === "TEMPORARY_HOLDING"
                            ? "暂养中"
                            : batch.status === "PARTIALLY_OUTBOUND"
                            ? "部分出库"
                            : batch.status === "COMPLETED"
                            ? "已完成"
                            : "冻结"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {batch.status !== "COMPLETED" && (
                          <LossRegisterDialog batch={batch} userId={defaultUser.id} />
                        )}
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
