import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FarmerDialog, FarmerDetailDialog, type FarmerWithStats } from "@/components/forms/FarmerDialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Scale, MapPin } from "lucide-react";
import { StaggerContainer, FadeIn, AnimatedNumber } from "@/components/motion/MotionWrapper";

export const dynamic = "force-dynamic";

export default async function FarmersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 10);

  const [currentUser, totalFarmers, rawFarmers, statsAgg] = await Promise.all([
    getCurrentUser(),
    prisma.farmer.count(),
    prisma.farmer.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        enclosures: true,
        batches: {
          include: {
            outboundOrders: {
              where: { status: "APPROVED" },
            },
          },
        },
        tagClaims: {
          where: { status: "APPROVED" },
        },
      },
      orderBy: { code: "asc" },
    }),
    prisma.farmer.aggregate({
      _sum: { area: true, quota: true },
    }),
  ]);

  const currentUserId = currentUser?.id || "";
  const isFarmerAdminOrAdmin = currentUser?.role === "FARMER_ADMIN" || currentUser?.role === "ADMIN";

  const farmers: FarmerWithStats[] = rawFarmers.map((f) => {
    const currentYearBatches = f.batches.filter(
      (b) => new Date(b.inPoolTime).getFullYear() === f.year
    );
    const currentYearTags = f.tagClaims.filter(
      (t) => new Date(t.claimDate).getFullYear() === f.year
    );

    const cumulativeInPool = currentYearBatches.reduce((sum, b) => sum + b.inPoolCount, 0);
    const cumulativeClaimed = currentYearTags.reduce((sum, t) => sum + t.claimCount, 0);
    const cumulativeOutbound = currentYearBatches.reduce(
      (sum, b) => sum + b.outboundOrders.reduce((s, o) => s + o.outboundCount, 0),
      0
    );
    const remainingQuota = Math.max(0, f.quota - cumulativeInPool);
    return {
      ...f,
      cumulativeInPool,
      cumulativeClaimed,
      cumulativeOutbound,
      remainingQuota,
    };
  });

  return (
    <StaggerContainer className="flex flex-col gap-4">
      <FadeIn direction="down" className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            养殖档案
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            签约养殖户主档、围网面积核定与年度理论产能额度闭环管理
          </p>
        </div>
        {isFarmerAdminOrAdmin && <FarmerDialog userId={currentUserId} />}
      </FadeIn>

      <FadeIn className="grid gap-3 sm:grid-cols-3">
        <Card className="transition-all hover:shadow-xs border-border/80">
          <CardHeader className="p-3 pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">签约养殖户总数</CardTitle>
            <Scale className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold font-mono text-foreground flex items-baseline gap-1">
              <AnimatedNumber value={totalFarmers} />
              <span className="text-xs font-normal text-muted-foreground">户</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">正常合作中</p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-xs border-border/80">
          <CardHeader className="p-3 pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">总核定养殖面积</CardTitle>
            <MapPin className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold font-mono text-foreground flex items-baseline gap-1">
              {(statsAgg._sum.area || 0).toFixed(1)}
              <span className="text-xs font-normal text-muted-foreground">亩</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">签约水域面积</p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-xs border-border/80">
          <CardHeader className="p-3 pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">全年核定总额度</CardTitle>
            <Scale className="size-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold font-mono text-foreground flex items-baseline gap-1">
              <AnimatedNumber value={statsAgg._sum.quota || 0} />
              <span className="text-xs font-normal text-muted-foreground">只</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">标准产能 600 只/亩</p>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[200px]">养殖户主档与类型</TableHead>
                    <TableHead className="w-[160px]">养殖水域与面积</TableHead>
                    <TableHead className="min-w-[240px]">年度额度与入池余量水位</TableHead>
                    <TableHead className="w-[120px]">合作状态</TableHead>
                    <TableHead className="text-right w-[140px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {farmers.map((farmer) => {
                    const remainingPct = farmer.quota > 0 ? (farmer.remainingQuota / farmer.quota) * 100 : 0;
                    const pct = Math.min(100, Math.max(0, remainingPct));

                    // 余量颜色：<= 10% 红色警示，<= 30% 黄色，> 30% 翡翠绿
                    const barColor =
                      pct <= 10 ? "bg-destructive" : pct <= 30 ? "bg-amber-500" : "bg-emerald-600";
                    const textColor =
                      pct <= 10 ? "text-destructive" : pct <= 30 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";

                    const enclosureCodes = farmer.enclosures.map((e) => e.code).join(", ") || "未划分围网";

                    return (
                      <TableRow key={farmer.id} className="group">
                        {/* 1. 养殖户主档 */}
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-1.5">
                              <FarmerDetailDialog farmer={farmer} userId={currentUserId}>
                                <button
                                  type="button"
                                  className="font-bold text-foreground hover:text-primary hover:underline cursor-pointer transition-colors text-left text-sm"
                                  title="点击查看养殖户完整档案"
                                >
                                  {farmer.name}
                                </button>
                              </FarmerDetailDialog>
                              <Badge
                                variant="outline"
                                className={
                                  farmer.creditRating === "A"
                                    ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-normal text-[10px] px-1.5 py-0"
                                    : farmer.creditRating === "B"
                                    ? "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-normal text-[10px] px-1.5 py-0"
                                    : "border-destructive/30 text-destructive bg-destructive/10 font-normal text-[10px] px-1.5 py-0"
                                }
                              >
                                {farmer.creditRating} 级
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-muted-foreground">{farmer.code}</span>
                              <Badge
                                variant="outline"
                                className="border-primary/30 text-primary bg-primary/5 text-[10px] px-1.5 py-0"
                              >
                                湖蟹
                              </Badge>
                            </div>
                          </div>
                        </TableCell>

                        {/* 2. 养殖水域与面积 */}
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-foreground text-sm font-mono">
                              {farmer.area} 亩
                            </span>
                            <span className="font-mono text-xs text-muted-foreground truncate max-w-[150px]" title={enclosureCodes}>
                              {enclosureCodes} 围网
                            </span>
                          </div>
                        </TableCell>

                        {/* 3. 年度额度与在池余量 */}
                        <TableCell>
                          <div className="flex flex-col gap-1.5 min-w-[180px]">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className={`font-mono font-bold text-sm leading-tight ${textColor}`}>
                                剩余 {farmer.remainingQuota.toLocaleString()} 只
                              </span>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                ({remainingPct.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="relative h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                                {farmer.cumulativeInPool.toLocaleString()} / {farmer.quota.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 4. 合作状态 (单列单责) */}
                        <TableCell>
                          {farmer.status === "ACTIVE" ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-normal text-xs flex items-center gap-1.5 w-fit"
                            >
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              合作中
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-destructive/30 text-destructive bg-destructive/10 font-normal text-xs flex items-center gap-1.5 w-fit"
                            >
                              <span className="size-1.5 rounded-full bg-destructive" />
                              暂停合作
                            </Badge>
                          )}
                        </TableCell>

                        {/* 5. 操作 */}
                        <TableCell className="text-right">
                          {isFarmerAdminOrAdmin ? (
                            <FarmerDialog
                              farmer={farmer}
                              userId={currentUserId}
                              trigger={
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs border-border/80 hover:bg-muted font-medium"
                                >
                                  编辑档案
                                </Button>
                              }
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">只读</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination total={totalFarmers} page={page} pageSize={pageSize} />
          </CardContent>
        </Card>
      </FadeIn>
    </StaggerContainer>
  );
}
