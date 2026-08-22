import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Scale,
  Waves,
  Tag,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { StaggerContainer, FadeIn, AnimatedNumber, PulseBadge } from "@/components/motion/MotionWrapper";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [farmers, batches, pools, tagClaims, outboundOrders] = await Promise.all([
    prisma.farmer.findMany(),
    prisma.batch.findMany(),
    prisma.holdingPool.findMany({ include: { batches: true } }),
    prisma.tagClaim.findMany(),
    prisma.outboundOrder.findMany(),
  ]);

  const totalQuota = farmers.reduce((sum, f) => sum + f.quota, 0);
  const totalInPool = batches.reduce((sum, b) => sum + b.inPoolCount, 0);
  const totalOutPool = batches.reduce((sum, b) => sum + b.outPoolCount, 0);
  const totalLoss = batches.reduce((sum, b) => sum + b.lossCount, 0);
  const totalLiveInPool = totalInPool - totalOutPool - totalLoss;

  const totalTagsClaimed = tagClaims.reduce((sum, c) => sum + c.claimCount, 0);
  const totalTagsBound = tagClaims.reduce((sum, c) => sum + c.boundCount, 0);

  const pendingApprovals =
    tagClaims.filter((c) => c.status === "PENDING").length +
    outboundOrders.filter((o) => o.status === "PENDING").length;

  const unBalancedClaims = tagClaims.filter((c) => !c.isBalanced).length;

  return (
    <StaggerContainer className="flex flex-col gap-6">
      {/* 顶部标题与合规声明 */}
      <FadeIn direction="down" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">总览看板</h1>
          </div>
          <p className="text-xs text-muted-foreground">大闸蟹数量闭环与品控运营总览</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium text-xs">
            <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
            数量守恒正常
          </Badge>
          {pendingApprovals > 0 && (
            <Badge variant="destructive" className="font-mono text-xs">
              {pendingApprovals} 笔待审批
            </Badge>
          )}
        </div>
      </FadeIn>

      {/* 四大核心数量卡片 */}
      <FadeIn>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5 transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">年度签约总额度</CardTitle>
              <Scale className="text-muted-foreground/70 size-4" />
            </CardHeader>
            <CardContent className="p-0 pt-3">
              <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
                <AnimatedNumber value={totalQuota} /> <span className="text-xs font-normal text-muted-foreground">只</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                签约养殖户 {farmers.length} 户
              </p>
            </CardContent>
          </Card>

          <Card className="p-5 transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">累计原料入池数</CardTitle>
              <Waves className="text-muted-foreground/70 size-4" />
            </CardHeader>
            <CardContent className="p-0 pt-3">
              <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
                <AnimatedNumber value={totalInPool} /> <span className="text-xs font-normal text-muted-foreground">只</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                额度使用率 {totalQuota > 0 ? ((totalInPool / totalQuota) * 100).toFixed(1) : 0}% · 在池存活 {totalLiveInPool.toLocaleString()} 只
              </p>
            </CardContent>
          </Card>

          <Card className="p-5 transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">蟹扣累计领用/核销</CardTitle>
              <Tag className="text-muted-foreground/70 size-4" />
            </CardHeader>
            <CardContent className="p-0 pt-3">
              <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
                <AnimatedNumber value={totalTagsClaimed} /> <span className="text-xs font-normal text-muted-foreground">只</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500"></span>
                已绑扣 {totalTagsBound.toLocaleString()} 只 · 未轧平 {unBalancedClaims} 笔
              </p>
            </CardContent>
          </Card>

          <Card className="p-5 transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">累计出库发运数</CardTitle>
              <Truck className="text-muted-foreground/70 size-4" />
            </CardHeader>
            <CardContent className="p-0 pt-3">
              <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
                <AnimatedNumber value={totalOutPool} /> <span className="text-xs font-normal text-muted-foreground">只</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                已出库 {outboundOrders.filter((o) => o.status === "APPROVED").length} 批次
              </p>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* 核心数量闭环证明等式 */}
      <FadeIn>
        <Card className="border-border/80 bg-card p-5">
          <CardHeader className="p-0 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4.5 text-primary" />
              <CardTitle className="text-sm font-semibold text-foreground">全链路数量守恒核对</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-4 font-mono text-xs">
              <div className="rounded-md border border-border/80 bg-secondary/50 p-3.5 flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px]">累计出库数</span>
                <span className="text-base font-bold text-foreground">{totalOutPool.toLocaleString()} 只</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">≤ 领扣核销数</span>
              </div>
              <div className="rounded-md border border-border/80 bg-secondary/50 p-3.5 flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px]">累计核销蟹扣数</span>
                <span className="text-base font-bold text-foreground">{totalTagsBound.toLocaleString()} 只</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">≤ 累计领扣数</span>
              </div>
              <div className="rounded-md border border-border/80 bg-secondary/50 p-3.5 flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px]">累计原料入池数</span>
                <span className="text-base font-bold text-foreground">{totalInPool.toLocaleString()} 只</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">≤ 年度签约额度</span>
              </div>
              <div className="rounded-md border border-border/80 bg-secondary/50 p-3.5 flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px]">签约年度额度</span>
                <span className="text-base font-bold text-foreground">{totalQuota.toLocaleString()} 只</span>
                <span className="text-[10px] text-muted-foreground font-sans">额度上限</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* 快捷业务流入口 */}
      <FadeIn>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="flex flex-col justify-between transition-all hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-base">原料批次入池登记</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/batches">
                <Button className="w-full">
                  前往批次管理
                  <ArrowRight className="size-4" data-icon="inline-end" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between transition-all hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-base">蟹扣领用与日清日结</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/tags">
                <Button variant="secondary" className="w-full">
                  前往蟹扣核销
                  <ArrowRight className="size-4" data-icon="inline-end" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between transition-all hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-base">合规台账查询</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/ledgers">
                <Button variant="outline" className="w-full">
                  查看合规台账
                  <ArrowRight className="size-4" data-icon="inline-end" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </FadeIn>
    </StaggerContainer>
  );
}
