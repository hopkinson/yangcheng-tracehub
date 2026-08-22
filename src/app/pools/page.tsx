import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PoolDialog } from "@/components/forms/PoolDialog";
import { Waves, Lock, Unlock, CheckCircle2, ArrowDownToDot, Truck, AlertOctagon } from "lucide-react";
import { StaggerContainer, FadeIn, PulseBadge } from "@/components/motion/MotionWrapper";

export const dynamic = "force-dynamic";

export default async function PoolsPage() {
  const [currentUser, pools] = await Promise.all([
    getCurrentUser(),
    prisma.holdingPool.findMany({
      include: {
        batches: {
          where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } },
          include: { farmer: true },
        },
      },
      orderBy: { code: "asc" },
    }),
  ]);

  const currentUserId = currentUser?.id || "";
  const isWarehouseOrAdmin = currentUser?.role === "WAREHOUSE_ADMIN" || currentUser?.role === "ADMIN";

  return (
    <StaggerContainer className="flex flex-col gap-6">
      <FadeIn direction="down" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">暂养监控</h1>
          <p className="text-xs text-muted-foreground">暂养池状态监控与规格混池卡控</p>
        </div>
        {isWarehouseOrAdmin && <PoolDialog userId={currentUserId} />}
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pools.map((pool) => {
          const totalIn = pool.batches.reduce((sum, b) => sum + b.inPoolCount, 0);
          const totalOut = pool.batches.reduce((sum, b) => sum + b.outPoolCount, 0);
          const totalLoss = pool.batches.reduce((sum, b) => sum + b.lossCount, 0);
          const totalLive = totalIn - totalOut - totalLoss;
          const isOccupied = pool.batches.length > 0 && totalLive > 0;

          // 计算比例条宽度
          const livePct = totalIn > 0 ? (totalLive / totalIn) * 100 : 0;
          const outPct = totalIn > 0 ? (totalOut / totalIn) * 100 : 0;
          const lossPct = totalIn > 0 ? (totalLoss / totalIn) * 100 : 0;
          const lossRate = totalIn > 0 ? ((totalLoss / totalIn) * 100).toFixed(1) : "0.0";

          return (
            <FadeIn key={pool.id} className="h-full">
              <Card className={`h-full flex flex-col ${isOccupied ? "border-primary/40 shadow-sm transition-all hover:shadow-md" : "border-dashed bg-muted/10"}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${isOccupied ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Waves className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-base font-semibold">{pool.name}</CardTitle>
                        {isWarehouseOrAdmin && <PoolDialog pool={pool} userId={currentUserId} />}
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{pool.code}</span>
                    </div>
                  </div>
                  {isOccupied ? (
                    <PulseBadge color="emerald">
                      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-xs">在养使用中</Badge>
                    </PulseBadge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">空闲待命中</Badge>
                  )}
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-4">
                  {/* 1. 规格锁定胶囊卡 */}
                  {pool.currentGender ? (
                    <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Lock className="size-3.5 text-primary" />
                        在养规格锁定
                      </span>
                      <span className="font-bold text-foreground">
                        {pool.currentGender === "MALE" ? "公蟹" : "母蟹"} · {pool.currentWeightTier}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Unlock className="size-3.5" />
                        规格未锁定
                      </span>
                      <span className="italic">空池 · 允许任意规格入池</span>
                    </div>
                  )}

                  {/* 2. 存量与可视化多段流转条 */}
                  <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">实时在池存活</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {totalLive.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">只</span>
                      </div>
                    </div>

                    {/* 彩色流转比例条 (精细纤细样式) */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80 flex my-0.5">
                      {livePct > 0 && (
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${livePct}%` }}
                          title={`在池: ${totalLive} 只 (${livePct.toFixed(1)}%)`}
                        />
                      )}
                      {outPct > 0 && (
                        <div
                          className="h-full bg-sky-500 transition-all"
                          style={{ width: `${outPct}%` }}
                          title={`已出库: ${totalOut} 只 (${outPct.toFixed(1)}%)`}
                        />
                      )}
                      {lossPct > 0 && (
                        <div
                          className="h-full bg-rose-500 transition-all"
                          style={{ width: `${lossPct}%` }}
                          title={`损耗: ${totalLoss} 只 (${lossPct.toFixed(1)}%)`}
                        />
                      )}
                    </div>

                    {/* 3. 三列迷你指标格 */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="flex flex-col rounded border border-border/60 bg-background/60 p-1.5 text-center">
                        <span className="text-[11px] text-muted-foreground flex items-center justify-center gap-0.5">
                          <ArrowDownToDot className="size-3 text-emerald-500" />
                          初始入池
                        </span>
                        <span className="font-mono text-xs font-semibold">{totalIn.toLocaleString()}</span>
                      </div>

                      <div className="flex flex-col rounded border border-border/60 bg-background/60 p-1.5 text-center">
                        <span className="text-[11px] text-muted-foreground flex items-center justify-center gap-0.5">
                          <Truck className="size-3 text-sky-500" />
                          累计出池
                        </span>
                        <span className="font-mono text-xs font-semibold text-sky-600 dark:text-sky-400">
                          {totalOut.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex flex-col rounded border border-border/60 bg-background/60 p-1.5 text-center">
                        <span className="text-[11px] text-muted-foreground flex items-center justify-center gap-0.5">
                          <AlertOctagon className="size-3 text-rose-500" />
                          累计损耗
                        </span>
                        <span className={`font-mono text-xs font-semibold ${Number(lossRate) > 5 ? "text-rose-600" : "text-foreground"}`}>
                          {totalLoss.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">({lossRate}%)</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. 在养批次清单 */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium">在养原料批次</span>
                      <span className="font-mono">{pool.batches.length} 个批次</span>
                    </div>

                    <div className="h-[74px] overflow-y-auto pr-0.5 flex flex-col gap-1.5">
                      {pool.batches.length === 0 ? (
                        <div className="h-full flex items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/10 text-xs text-muted-foreground italic">
                          暂无在养批次
                        </div>
                      ) : (
                        pool.batches.map((b) => {
                          const batchLive = b.inPoolCount - b.outPoolCount - b.lossCount;
                          return (
                            <div
                              key={b.id}
                              className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-2 py-1.5 text-xs"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-mono font-medium">{b.code}</span>
                                <span className="text-muted-foreground truncate">· {b.farmer.name}</span>
                              </div>
                              <span className="font-mono font-semibold text-emerald-600 shrink-0">{batchLive} 只</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 5. 底部防呆规则提示 */}
                  <div className="mt-auto border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                    {isOccupied
                      ? `允许复用入池: 仅限【${pool.currentGender === "MALE" ? "公蟹" : "母蟹"} ${pool.currentWeightTier}】`
                      : "允许入池: 任何规格（入池后自动锁定该规格）"}
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          );
        })}
      </div>
    </StaggerContainer>
  );
}
