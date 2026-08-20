import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Waves, Lock, Unlock, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PoolsPage() {
  const pools = await prisma.holdingPool.findMany({
    include: {
      batches: {
        where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } },
        include: { farmer: true },
      },
    },
    orderBy: { code: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">暂养池全景监控看板</h1>
        <p className="text-sm text-muted-foreground">
          暂养池管理原则：按规格复用。在养池可继续接收同公母、同重量档位的原料批次入池；不同公母或不同规格禁止混池；批次暂养期间不换池。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pools.map((pool) => {
          const totalLive = pool.batches.reduce(
            (sum, b) => sum + (b.inPoolCount - b.outPoolCount - b.lossCount),
            0
          );
          const isOccupied = pool.batches.length > 0 && totalLive > 0;

          return (
            <Card key={pool.id} className={isOccupied ? "border-primary/40 shadow-sm" : "border-dashed"}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Waves className="size-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">{pool.name}</CardTitle>
                    <span className="font-mono text-xs text-muted-foreground">{pool.code}</span>
                  </div>
                </div>
                <Badge variant={isOccupied ? "default" : "secondary"}>
                  {isOccupied ? "在养使用中" : "空闲待命中"}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-md bg-muted/40 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">在养规格锁定:</span>
                    {pool.currentGender ? (
                      <span className="font-bold text-foreground flex items-center gap-1">
                        <Lock className="size-3 text-primary" />
                        {pool.currentGender === "MALE" ? "公蟹" : "母蟹"} · {pool.currentWeightTier}
                      </span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Unlock className="size-3" />
                        未锁定 (空池)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">实时在池存活:</span>
                    <span className="font-mono font-bold text-lg text-emerald-600">
                      {totalLive.toLocaleString()} 只
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">当前在养批次数:</span>
                    <span className="font-mono">{pool.batches.length} 个批次</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">在养原料批次:</span>
                  {pool.batches.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">暂无在养批次，可自由入池新规格</p>
                  ) : (
                    <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                      {pool.batches.map((b) => {
                        const batchLive = b.inPoolCount - b.outPoolCount - b.lossCount;
                        return (
                          <div
                            key={b.id}
                            className="flex items-center justify-between rounded border px-2 py-1 text-xs"
                          >
                            <span className="font-mono">{b.code}</span>
                            <span className="text-muted-foreground">{b.farmer.name}</span>
                            <span className="font-mono font-semibold">{batchLive} 只</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t pt-2 text-[11px] text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="size-3 text-primary" />
                  {isOccupied
                    ? `允许复用入池: 仅限【${pool.currentGender === "MALE" ? "公蟹" : "母蟹"} ${pool.currentWeightTier}】`
                    : "允许入池: 任何规格（入池后自动锁定该规格）"}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
