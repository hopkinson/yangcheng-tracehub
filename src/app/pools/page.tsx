import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PoolDialog } from "@/components/forms/PoolDialog";
import { ClearPoolDialog } from "@/components/forms/ClearPoolDialog";
import { QCRecordDialog } from "@/components/qc/QCRecordDialog";
import { QCViewDialog } from "@/components/qc/QCViewDialog";
import { LedgerDateFilter } from "@/components/ledgers/LedgerDateFilter";
import {
  Waves,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Droplets,
  ClipboardList,
  Layers,
} from "lucide-react";
import { StaggerContainer, FadeIn, PulseBadge } from "@/components/motion/MotionWrapper";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; cat?: string }>;
}) {
  const params = await searchParams;
  const selectedDateStr = params.date?.trim();
  const selectedCat = params.cat?.trim();

  // 当天时间窗口 (2026-09-21 演示基准)
  const todayStart = new Date("2026-09-21T00:00:00.000Z");
  const todayEnd = new Date("2026-09-21T23:59:59.999Z");

  const dateFilter = selectedDateStr
    ? { gte: startOfDay(parseISO(selectedDateStr)), lte: endOfDay(parseISO(selectedDateStr)) }
    : undefined;

  const [currentUser, pools, todayQCs, poolQCRecords] = await Promise.all([
    getCurrentUser(),
    prisma.holdingPool.findMany({
      include: {
        batchItems: {
          include: {
            batch: {
              include: { farmer: true },
            },
          },
        },
      },
      orderBy: { code: "asc" },
    }),
    prisma.qCRecord.findMany({
      where: {
        refType: "POOL",
        checkTime: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { checkTime: "desc" },
    }),
    prisma.qCRecord.findMany({
      where: {
        refType: "POOL",
        cat: { in: ["WATER_QUALITY", "POOL_INSPECT"] },
        ...(selectedCat ? { cat: selectedCat } : {}),
        ...(dateFilter ? { checkTime: dateFilter } : {}),
      },
      orderBy: { checkTime: "desc" },
    }),
  ]);

  const currentUserId = currentUser?.id || "";
  const isWarehouseOrAdmin = currentUser?.role === "WAREHOUSE_ADMIN" || currentUser?.role === "ADMIN";

  return (
    <StaggerContainer className="flex flex-col gap-8">
      {/* 顶部标题与池管理 */}
      <FadeIn direction="down" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Waves className="size-6 text-primary" />
            暂养监控
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            暂养池实时卡片监控与合池聚合 · 当日水质/巡检异常精准告警（隔日自动消退）
          </p>
        </div>
        {isWarehouseOrAdmin && <PoolDialog userId={currentUserId} />}
      </FadeIn>

      {/* 8 个池卡片网格 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pools.map((pool: any) => {
          const items = pool.batchItems || [];
          const totalIn = items.reduce((sum: number, it: any) => sum + it.inPoolCount, 0);
          const totalOut = items.reduce((sum: number, it: any) => sum + (it.outPoolCount || 0), 0);
          const totalLoss = items.reduce((sum: number, it: any) => sum + (it.lossCount || 0), 0);
          const totalLive = Math.max(0, totalIn - totalOut - totalLoss);
          const isOccupied = totalLive > 0;

          // 识别在养合池批次
          const activeBatchesMap = new Map<string, { farmerName: string; code: string }>();
          items.forEach((it: any) => {
            const live = it.inPoolCount - (it.outPoolCount || 0) - (it.lossCount || 0);
            if (live > 0 && it.batch) {
              activeBatchesMap.set(it.batch.id, {
                farmerName: it.batch.farmer?.name || "未知农户",
                code: it.batch.code,
              });
            }
          });
          const activeBatches = Array.from(activeBatchesMap.values());
          const isMerged = activeBatches.length >= 2;

          // 当天巡检记录 (严格按巡检时间 checkTime 口径)
          const poolTodayQCs = todayQCs.filter((q: any) => q.refId === pool.code);
          const hasTodayException = poolTodayQCs.some((q: any) => q.result === "EXCEPTION");
          const latestTodayQC = poolTodayQCs[0];

          // 存量流转比例
          const livePct = totalIn > 0 ? (totalLive / totalIn) * 100 : 0;
          const outPct = totalIn > 0 ? (totalOut / totalIn) * 100 : 0;
          const lossPct = totalIn > 0 ? (totalLoss / totalIn) * 100 : 0;
          const lossRate = totalIn > 0 ? ((totalLoss / totalIn) * 100).toFixed(1) : "0.0";

          return (
            <FadeIn key={pool.id} className="h-full">
              <Card
                className={`h-full flex flex-col transition-all ${
                  hasTodayException
                    ? "border-destructive/80 bg-destructive/5 shadow-sm"
                    : isOccupied
                    ? "border-primary/40 shadow-xs hover:shadow-md"
                    : "border-dashed bg-muted/10"
                }`}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg ${
                        hasTodayException
                          ? "bg-destructive/15 text-destructive"
                          : isOccupied
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Waves className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-sm font-semibold">{pool.name}</CardTitle>
                        {isWarehouseOrAdmin && <PoolDialog pool={pool} userId={currentUserId} />}
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">{pool.code}</span>
                    </div>
                  </div>

                  <div className="flex items-center">
                    {hasTodayException ? (
                      <PulseBadge color="rose">
                        <Badge variant="destructive" className="text-[11px] px-1.5 py-0 h-5">
                          <AlertTriangle className="size-3 mr-0.5" /> 今日异常
                        </Badge>
                      </PulseBadge>
                    ) : isOccupied ? (
                      <PulseBadge color="emerald">
                        <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-[11px] px-1.5 py-0 h-5">
                          在养中
                        </Badge>
                      </PulseBadge>
                    ) : (
                      <Badge variant="secondary" className="text-[11px] px-1.5 py-0 h-5">
                        空闲
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-2.5 text-xs">
                  {/* 1. 规格锁定胶囊卡 */}
                  {pool.currentGender ? (
                    <div className="flex items-center justify-between rounded border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                        <Lock className="size-3 text-primary" />
                        <span>规格锁定:</span>
                        <span className="font-bold text-foreground">
                          {pool.currentGender === "MALE" ? "公蟹" : "母蟹"} · {pool.currentWeightTier}
                        </span>
                      </div>
                      {isWarehouseOrAdmin && (
                        <ClearPoolDialog pool={pool} totalLive={totalLive} userId={currentUserId} />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded border border-dashed border-border/80 bg-muted/20 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Unlock className="size-3" />
                        未锁定
                      </span>
                      <span className="italic">空池 · 允许任意规格入池</span>
                    </div>
                  )}

                  {/* 2. 合池信息标示 */}
                  {isMerged && (
                    <div className="flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
                      <Layers className="size-3.5 shrink-0" />
                      <span className="truncate font-medium">
                        {activeBatches.map((b) => `${b.farmerName}(${b.code})`).join("、")} · {activeBatches.length} 批次合池
                      </span>
                    </div>
                  )}

                  {/* 3. 实时存活数与比例条 */}
                  <div className="flex flex-col gap-1.5 rounded-lg bg-muted/30 p-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] text-muted-foreground">在池存活</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          {totalLive.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-muted-foreground">只</span>
                      </div>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted flex">
                      {livePct > 0 && (
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${livePct}%` }} />
                      )}
                      {outPct > 0 && (
                        <div className="h-full bg-sky-500 transition-all" style={{ width: `${outPct}%` }} />
                      )}
                      {lossPct > 0 && (
                        <div className="h-full bg-rose-500 transition-all" style={{ width: `${lossPct}%` }} />
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] text-center">
                      <div className="rounded border bg-background/60 p-1">
                        <span className="text-muted-foreground block">初始入池</span>
                        <span className="font-mono font-semibold">{totalIn.toLocaleString()}</span>
                      </div>
                      <div className="rounded border bg-background/60 p-1">
                        <span className="text-muted-foreground block">已出池</span>
                        <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">
                          {totalOut.toLocaleString()}
                        </span>
                      </div>
                      <div className="rounded border bg-background/60 p-1">
                        <span className="text-muted-foreground block">损耗</span>
                        <span
                          className={`font-mono font-semibold ${
                            Number(lossRate) > 5 ? "text-rose-600" : "text-foreground"
                          }`}
                        >
                          {totalLoss.toLocaleString()} ({lossRate}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. 当日水质/巡检状态与快捷填报 */}
                  <div className="flex flex-col gap-1.5 rounded border bg-card/60 p-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">今日品控:</span>
                      {latestTodayQC ? (
                        <QCViewDialog
                          record={latestTodayQC}
                          triggerText={latestTodayQC.result === "EXCEPTION" ? "⚠️ 今日异常记录" : "✅ 正常合格"}
                        />
                      ) : (
                        <span className="text-muted-foreground italic text-[10px]">今日暂无巡检</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border/50">
                      <QCRecordDialog
                        config={{
                          cat: "WATER_QUALITY",
                          categoryLabel: "水质监测记录表",
                          defaultTitle: `${pool.code} 水质监测`,
                          formNoPreset: "YCGF-PZZX-202605",
                          refType: "POOL",
                          refId: pool.code,
                          conclusions: [
                            "符合暂养水质卫生要求 (水温21.2℃, 溶氧7.5mg/L, 氨氮0.12mg/L)",
                            "水温偏高 (>24℃)，已开启水循环制冷",
                            "氨氮 0.28mg/L 超标，已启动换水并安排复检",
                          ],
                        }}
                        triggerLabel="水质监测"
                      />

                      <QCRecordDialog
                        config={{
                          cat: "POOL_INSPECT",
                          categoryLabel: "暂养巡检记录表",
                          defaultTitle: `${pool.code} 暂养巡检`,
                          formNoPreset: "YCGF-PZZX-202604",
                          refType: "POOL",
                          refId: pool.code,
                          conclusions: [
                            "全部项目合格，暂养环境正常",
                            "存在轻微异常，已整改，可正常暂养",
                            "问题未解决，暂停该池暂养，限期整改",
                          ],
                        }}
                        triggerLabel="暂养巡检"
                      />
                    </div>
                  </div>

                  {/* 底部防呆规则 */}
                  <div className="mt-auto border-t border-border/50 pt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-primary shrink-0" />
                    <span className="truncate">
                      {isOccupied
                        ? `锁定【${pool.currentGender === "MALE" ? "公蟹" : "母蟹"} ${pool.currentWeightTier}】`
                        : "空池可入任意规格"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          );
        })}
      </div>

      {/* 底部品控留痕台账 */}
      <FadeIn direction="up">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" />
                暂养品控留痕台账 (水质监测 / 暂养巡检)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                巡检实际发生时间 vs 系统上传时间双时间戳留痕 · 支持按日期筛选与纸质表 202604/202605 原件穿透
              </p>
            </div>

            <div className="flex items-center gap-2">
              <LedgerDateFilter selectedDate={selectedDateStr} />
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead className="w-[130px]">记录编号</TableHead>
                    <TableHead className="w-[160px]">记录类别 / 表号</TableHead>
                    <TableHead className="w-[100px]">关联池</TableHead>
                    <TableHead className="w-[150px]">巡检发生时间</TableHead>
                    <TableHead className="w-[150px]">系统上传时间</TableHead>
                    <TableHead className="w-[100px]">判定结果</TableHead>
                    <TableHead>巡检结论 / 异常整改说明</TableHead>
                    <TableHead className="w-[90px]">质检员</TableHead>
                    <TableHead className="w-[80px] text-right">纸质原件</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poolQCRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-xs text-muted-foreground">
                        暂无暂养品控记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    poolQCRecords.map((record: any) => {
                      const isException = record.result === "EXCEPTION";
                      const isWater = record.cat === "WATER_QUALITY";

                      return (
                        <TableRow key={record.id} className="text-xs hover:bg-muted/30">
                          <TableCell className="font-mono font-medium text-foreground">
                            {record.code}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium flex items-center gap-1">
                                {isWater ? (
                                  <Droplets className="size-3 text-sky-500" />
                                ) : (
                                  <ClipboardList className="size-3 text-indigo-500" />
                                )}
                                {isWater ? "水质监测记录" : "暂养巡检记录"}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {record.formNo || (isWater ? "YCGF-PZZX-202605" : "YCGF-PZZX-202604")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[11px]">
                              {record.refId}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="size-3 text-primary" />
                              {formatDateTime(record.checkTime)}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            <span className="flex items-center gap-1 text-[11px]">
                              {formatDateTime(record.uploadTime)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {isException ? (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                异常/需整改
                              </Badge>
                            ) : record.conclusion?.includes("整改") ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                                已整改合格
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                合格
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5 max-w-[320px]">
                              <span className="text-foreground truncate">{record.conclusion}</span>
                              {record.reason && (
                                <span className="text-[11px] text-destructive truncate">
                                  整改说明: {record.reason}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{record.uploader}</TableCell>
                          <TableCell className="text-right">
                            <QCViewDialog record={record} triggerText="查看原件" />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </StaggerContainer>
  );
}
