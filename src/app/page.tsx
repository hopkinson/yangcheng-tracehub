import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Scale,
  Waves,
  Tag,
  Truck,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  Layers,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import { StaggerContainer, FadeIn, AnimatedNumber } from "@/components/motion/MotionWrapper";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [farmers, batches, pools, tagClaims, outboundOrders] = await Promise.all([
    prisma.farmer.findMany(),
    prisma.batch.findMany({ include: { pool: true, farmer: true } }),
    prisma.holdingPool.findMany({ include: { batches: true } }),
    prisma.tagClaim.findMany(),
    prisma.outboundOrder.findMany({ include: { store: true } }),
  ]);

  const totalQuota = farmers.reduce((sum, f) => sum + f.quota, 0);
  const totalInPool = batches.reduce((sum, b) => sum + b.inPoolCount, 0);
  const totalOutPool = batches.reduce((sum, b) => sum + b.outPoolCount, 0);
  const totalLoss = batches.reduce((sum, b) => sum + b.lossCount, 0);
  const totalLiveInPool = Math.max(0, totalInPool - totalOutPool - totalLoss);

  const quotaUsageNum = totalQuota > 0 ? (totalInPool / totalQuota) * 100 : 0;
  const quotaUsageRate = quotaUsageNum.toFixed(1);
  const lossRate = totalInPool > 0 ? ((totalLoss / totalInPool) * 100).toFixed(1) : "0.0";

  const totalTagsClaimed = tagClaims.reduce((sum, c) => sum + c.claimCount, 0);
  const totalTagsBound = tagClaims.reduce((sum, c) => sum + c.boundCount, 0);
  const tagBoundNum = totalTagsClaimed > 0 ? (totalTagsBound / totalTagsClaimed) * 100 : 0;
  const tagBoundRate = tagBoundNum.toFixed(1);

  const pendingTagClaims = tagClaims.filter((c) => c.status === "PENDING").length;
  const pendingOutbound = outboundOrders.filter((o) => o.status === "PENDING").length;
  const totalPending = pendingTagClaims + pendingOutbound;
  const unBalancedClaims = tagClaims.filter((c) => !c.isBalanced).length;

  return (
    <StaggerContainer className="flex flex-col gap-5">
      {/* 顶部标题与系统状态 */}
      <FadeIn direction="down" className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between border-b border-border/70 pb-3.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">运营总览</h1>
            <Badge variant="outline" className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-300/40 dark:border-sky-800 font-normal text-xs py-0.5">
              <span className="size-1.5 rounded-full bg-sky-500 mr-1.5 inline-block animate-pulse" />
              实时运行中
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">大闸蟹全生命周期流转、库存监控与品控闭环</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalPending > 0 ? (
            <Link href="/approvals">
              <Badge variant="destructive" className="font-mono text-xs py-1 px-3 cursor-pointer hover:opacity-90 transition-opacity shadow-xs">
                <Clock className="size-3.5 mr-1.5 inline-block" />
                {totalPending} 笔待审批事项
              </Badge>
            </Link>
          ) : (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300/40 text-xs py-1 px-3">
              <CheckCircle2 className="size-3.5 mr-1.5 text-emerald-500 inline-block" />
              暂无待审批业务
            </Badge>
          )}
        </div>
      </FadeIn>

      {/* 核心：大闸蟹生命周期流转全景 (纯净纯色卡片，精致规整间距) */}
      <FadeIn>
        <Card className="border-border/80 shadow-xs overflow-hidden bg-card">
          <CardContent className="p-4 sm:p-4.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 环节 1: 签约配额 */}
              <div className="group relative flex flex-col justify-between rounded-lg border border-border/80 bg-card p-3.5 sm:p-4 transition-all hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <span className="flex size-5 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold border border-indigo-200/60 dark:border-indigo-800/60">1</span>
                      年度签约配额
                    </span>
                    <div className="size-6.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Scale className="size-3.5" />
                    </div>
                  </div>

                  <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
                    <AnimatedNumber value={totalQuota} />
                    <span className="text-xs font-normal text-muted-foreground ml-1">只</span>
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-border/60">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                    <span>签约农户 {farmers.length} 户</span>
                    <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">已入池 {quotaUsageRate}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, quotaUsageNum))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 环节 2: 暂养在池 */}
              <div className="group relative flex flex-col justify-between rounded-lg border border-sky-300 dark:border-sky-800 bg-card p-3.5 sm:p-4 transition-all hover:border-sky-400 dark:hover:border-sky-700 hover:shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <span className="flex size-5 items-center justify-center rounded-full bg-sky-500 text-white text-[11px] font-bold">2</span>
                      原料入池暂养
                    </span>
                    <div className="size-6.5 rounded-md bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <Waves className="size-3.5" />
                    </div>
                  </div>

                  <div className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-300 tracking-tight">
                    <AnimatedNumber value={totalInPool} />
                    <span className="text-xs font-normal text-muted-foreground ml-1">只</span>
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-border/60">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      当前在池: <strong className="font-mono text-sky-700 dark:text-sky-300 font-semibold">{totalLiveInPool.toLocaleString()}</strong> 只
                    </span>
                    <span className="rounded-md bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 text-[10px] font-mono text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60">
                      损耗 {lossRate}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 环节 3: 蟹扣核销 */}
              <div className="group relative flex flex-col justify-between rounded-lg border border-border/80 bg-card p-3.5 sm:p-4 transition-all hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <span className="flex size-5 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 text-[11px] font-bold border border-purple-200/60 dark:border-purple-800/60">3</span>
                      防伪蟹扣领用
                    </span>
                    <div className="size-6.5 rounded-md bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Tag className="size-3.5" />
                    </div>
                  </div>

                  <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
                    <AnimatedNumber value={totalTagsClaimed} />
                    <span className="text-xs font-normal text-muted-foreground ml-1">只</span>
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-border/60">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                    <span>已绑扣 {totalTagsBound.toLocaleString()} 只</span>
                    <span className="font-mono font-medium text-purple-600 dark:text-purple-400">核销 {tagBoundRate}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, tagBoundNum))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 环节 4: 出库发运 */}
              <div className="group relative flex flex-col justify-between rounded-lg border border-border/80 bg-card p-3.5 sm:p-4 transition-all hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200/60 dark:border-emerald-800/60">4</span>
                      成品出库发运
                    </span>
                    <div className="size-6.5 rounded-md bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Truck className="size-3.5" />
                    </div>
                  </div>

                  <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
                    <AnimatedNumber value={totalOutPool} />
                    <span className="text-xs font-normal text-muted-foreground ml-1">只</span>
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-border/60">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">完成 {outboundOrders.filter((o) => o.status === "APPROVED").length} 批次发运</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="size-3" />
                      100% 合规
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* 下层：暂养概况 + 待办预警 + 快捷操作 (平衡的 3 列布局) */}
      <FadeIn>
        <div className="grid gap-3.5 md:grid-cols-3">
          {/* 卡片 1: 暂养与库容概况 */}
          <div className="flex flex-col justify-between rounded-lg border border-border/80 bg-card p-4 sm:p-4.5 shadow-xs hover:shadow-sm transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-md bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Waves className="size-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    暂养与库容概况
                  </h3>
                </div>
                <Badge variant="outline" className="text-[10px] font-normal border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 bg-sky-50/50 dark:bg-sky-950/40 py-0.5">
                  {pools.filter((p) => p.status === "ACTIVE").length}/{pools.length} 运行中
                </Badge>
              </div>

              <div>
                <div className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-300 tracking-tight">
                  {totalLiveInPool.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">只在池</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  累计入池 {totalInPool.toLocaleString()} 只 · 损耗 {lossRate}%
                </p>
              </div>

              {/* 规格标签简况 */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {pools.slice(0, 3).map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {p.name}: {p.currentGender === "MALE" ? "公" : p.currentGender === "FEMALE" ? "母" : "全"}{" "}
                    {p.currentWeightTier || "通用"}
                  </span>
                ))}
              </div>
            </div>

            <Link href="/pools" className="block pt-3 mt-2 border-t border-border/50">
              <Button variant="ghost" size="sm" className="w-full justify-between h-7.5 text-xs text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/50 px-2">
                <span>进入暂养池大屏监控</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>

          {/* 卡片 2: 待办与异常预警 */}
          <div className="flex flex-col justify-between rounded-lg border border-border/80 bg-card p-4 sm:p-4.5 shadow-xs hover:shadow-sm transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-md bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Clock className="size-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    待办与预警中心
                  </h3>
                </div>
                {totalPending + unBalancedClaims === 0 && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300/40 text-[10px] py-0.5">
                    无积压
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                {totalPending > 0 ? (
                  <Link
                    href="/approvals"
                    className="flex items-center justify-between rounded-lg border border-amber-300/60 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 p-2 text-xs transition-all hover:bg-amber-100/60 dark:hover:bg-amber-900/40"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="truncate">
                        <div className="font-semibold text-amber-950 dark:text-amber-100">{totalPending} 笔业务待审批</div>
                        <div className="text-[10px] text-amber-800/80 dark:text-amber-300/80">
                          {pendingTagClaims > 0 && `领扣 ${pendingTagClaims} 笔 `}
                          {pendingOutbound > 0 && `出库 ${pendingOutbound} 笔`}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  </Link>
                ) : null}

                {unBalancedClaims > 0 ? (
                  <Link
                    href="/tags"
                    className="flex items-center justify-between rounded-lg border border-rose-300/60 dark:border-rose-800/60 bg-rose-50/70 dark:bg-rose-950/30 p-2 text-xs transition-all hover:bg-rose-100/60 dark:hover:bg-rose-900/40"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="size-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <div className="truncate">
                        <div className="font-semibold text-rose-950 dark:text-rose-100">{unBalancedClaims} 笔领扣未轧平</div>
                        <div className="text-[10px] text-rose-800/80 dark:text-rose-300/80">需登记核销与作废数</div>
                      </div>
                    </div>
                    <ArrowRight className="size-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  </Link>
                ) : null}

                {totalPending === 0 && unBalancedClaims === 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200/70 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 p-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                    <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>全链路流转顺畅，暂无待办或异常。</span>
                  </div>
                )}
              </div>
            </div>

            <Link href="/approvals" className="block pt-3 mt-2 border-t border-border/50">
              <Button variant="ghost" size="sm" className="w-full justify-between h-7.5 text-xs text-muted-foreground hover:text-foreground px-2">
                <span>进入审批中心处理</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>

          {/* 卡片 3: 常用业务通道 */}
          <div className="flex flex-col justify-between rounded-lg border border-border/80 bg-card p-4 sm:p-4.5 shadow-xs hover:shadow-sm transition-all">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Layers className="size-3.5" />
                </div>
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  常用业务入口
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-0.5">
                <Link href="/batches">
                  <Button variant="outline" size="sm" className="w-full justify-between h-8.5 text-xs hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30">
                    <span className="flex items-center gap-2">
                      <span className="size-5 rounded bg-indigo-50 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                        <Layers className="size-3" />
                      </span>
                      原料批次入池登记
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                  </Button>
                </Link>
                <Link href="/tags">
                  <Button variant="outline" size="sm" className="w-full justify-between h-8.5 text-xs hover:border-purple-300 hover:bg-purple-50/40 dark:hover:bg-purple-950/30">
                    <span className="flex items-center gap-2">
                      <span className="size-5 rounded bg-purple-50 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                        <Tag className="size-3" />
                      </span>
                      蟹扣领用与日清核销
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                  </Button>
                </Link>
                <Link href="/ledgers">
                  <Button variant="outline" size="sm" className="w-full justify-between h-8.5 text-xs hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30">
                    <span className="flex items-center gap-2">
                      <span className="size-5 rounded bg-emerald-50 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                        <ShieldCheck className="size-3" />
                      </span>
                      全链路合规台账查询
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </StaggerContainer>
  );
}


