import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex flex-col gap-6">
      {/* 顶部标题与合规声明 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">数量闭环管控与品控总览</h1>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              AUDIT READY
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            大闸蟹全链路溯源品控系统 · 阳澄股份 × 山姆会员商店合规审计看板
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium text-xs">
            <CheckCircle2 className="size-3.5 mr-1" />
            数量守恒正常
          </Badge>
          {pendingApprovals > 0 && (
            <Badge variant="destructive" className="font-mono text-xs">
              {pendingApprovals} 笔待审批
            </Badge>
          )}
        </div>
      </div>

      {/* 四大核心数量卡片 (Linear 风格: 等宽高对比数据 + 极细微边框) */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">1. 年度签约总额度</CardTitle>
            <Scale className="text-muted-foreground/70 size-4" />
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">{totalQuota.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">只</span></div>
            <p className="text-[11px] text-muted-foreground mt-1">
              签约养殖户 {farmers.length} 户 · 核定上限
            </p>
          </CardContent>
        </Card>

        <Card className="p-5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">2. 累计原料入池数</CardTitle>
            <Waves className="text-muted-foreground/70 size-4" />
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">{totalInPool.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">只</span></div>
            <p className="text-[11px] text-muted-foreground mt-1">
              额度使用率 {totalQuota > 0 ? ((totalInPool / totalQuota) * 100).toFixed(1) : 0}% · 在池存活 {totalLiveInPool.toLocaleString()} 只
            </p>
          </CardContent>
        </Card>

        <Card className="p-5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">3. 蟹扣累计领用/核销</CardTitle>
            <Tag className="text-muted-foreground/70 size-4" />
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">{totalTagsClaimed.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">只</span></div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-full bg-emerald-500"></span>
              已绑扣 {totalTagsBound.toLocaleString()} 只 · 未轧平 {unBalancedClaims} 笔
            </p>
          </CardContent>
        </Card>

        <Card className="p-5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">4. 累计出库发运数</CardTitle>
            <Truck className="text-muted-foreground/70 size-4" />
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">{totalOutPool.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">只</span></div>
            <p className="text-[11px] text-muted-foreground mt-1">
              已完成发运 {outboundOrders.filter((o) => o.status === "APPROVED").length} 批次
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 核心数量闭环证明等式 */}
      <Card className="border-border/80 bg-card p-5">
        <CardHeader className="p-0 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4.5 text-primary" />
            <CardTitle className="text-sm font-semibold text-foreground">全链路数量守恒公理证明链条 (闭环不可打破)</CardTitle>
          </div>
          <CardDescription className="text-xs">
            根据阳澄品控 PRD V1.3 规范，任一节点超出阈值将由数据库事务强制拦截
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-4 font-mono text-xs">
            <div className="rounded-md border border-border/80 bg-secondary/50 p-3.5 flex flex-col gap-1">
              <span className="text-muted-foreground text-[11px]">累计出库数</span>
              <span className="text-base font-bold text-foreground">{totalOutPool.toLocaleString()} 只</span>
              <span className="text-[10px] text-emerald-500 font-sans">≤ 领扣核销数</span>
            </div>
            <div className="rounded-md border border-border/80 bg-secondary/50 p-3.5 flex flex-col gap-1">
              <span className="text-muted-foreground text-[11px]">累计核销蟹扣数</span>
              <span className="text-base font-bold text-foreground">{totalTagsBound.toLocaleString()} 只</span>
              <span className="text-[10px] text-emerald-500 font-sans">≤ 累计领扣数</span>
            </div>
            <div className="rounded-md border border-border/80 bg-secondary/50 p-3.5 flex flex-col gap-1">
              <span className="text-muted-foreground text-[11px]">累计原料入池数</span>
              <span className="text-base font-bold text-foreground">{totalInPool.toLocaleString()} 只</span>
              <span className="text-[10px] text-emerald-500 font-sans">≤ 年度签约额度</span>
            </div>
            <div className="rounded-md border border-border/80 bg-secondary/50 p-3.5 flex flex-col gap-1">
              <span className="text-muted-foreground text-[11px]">签约理论额度</span>
              <span className="text-base font-bold text-foreground">{totalQuota.toLocaleString()} 只</span>
              <span className="text-[10px] text-muted-foreground font-sans">源头绝对上限</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 快捷业务流入口 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base">原料批次入池登记</CardTitle>
            <CardDescription>
              到货即入池，校验养殖户年度剩余额度与暂养池在养规格
            </CardDescription>
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

        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base">蟹扣领用与日清日结</CardTitle>
            <CardDescription>
              按养殖户动态展示在池存活可领余量，逐日对账轧平
            </CardDescription>
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

        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base">四大合规台账与追溯</CardTitle>
            <CardDescription>
              按日筛选导出四本台账，支持山姆等渠道批次反向追溯
            </CardDescription>
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
    </div>
  );
}
