"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Layers,
  Tag,
  Waves,
  PackageCheck,
  Cpu,
  ThermometerSnowflake,
  Truck,
  ShieldCheck,
  AlertOctagon,
  CheckCircle2,
  FileSearch,
  Radio,
  Thermometer,
  ArrowRight,
  Activity,
  ChevronLeft,
  ChevronRight,
  Wind,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FadeIn, PulseBadge, StaggerContainer, AnimatedNumber } from "@/components/motion/MotionWrapper";
import { cn } from "@/lib/utils";

export interface DashboardProps {
  metrics: {
    // 1. 订单
    todayOrdersCount: number;
    pendingDeliveryTotalCount: number;
    totalOrdersCount: number;
    // 2. 原料
    todayBatchesCount: number;
    todayInPoolTotalCount: number;
    totalBatchesCount: number;
    // 3. 蟹扣申领
    todayTagClaimsCount: number;
    todayTagClaimsTotalCount: number;
    totalTagClaimsCount: number;
    pendingTagClaimsCount: number;
    // 4. 暂养
    todayPoolInCount: number;
    activePoolsCount: number;
    totalLiveInPoolCount: number;
    // 5. 捆扎
    todayBundleBatchesCount: number;
    todayBundleTotalCount: number;
    todayBundleDoneCount: number;
    totalBundleBatchesCount: number;
    // 6. 分拣
    todaySortTasksCount: number;
    todaySortQualifiedCount: number;
    todaySortLossCount: number;
    totalSortTasksCount: number;
    // 7. 预冷
    todayColdIntakeCount: number;
    activeColdStoresCount: number;
    totalColdStockCount: number;
    // 8. 出库
    todayOutboundOrdersCount: number;
    todayOutboundTotalCount: number;
    pendingOutboundOrdersCount: number;
    totalOutboundOrdersCount: number;
    totalOutboundCount: number;
    // 漏斗
    totalQuota: number;
    totalInPool: number;
    totalTagClaimed: number;
  };
  activePools: Array<{
    id: string;
    code: string;
    name: string;
    currentGender: string | null;
    currentWeightTier: string | null;
    liveCount: number;
  }>;
  qcRecords: Array<{
    id: string;
    code: string;
    cat: string;
    refType: string;
    refId: string;
    title: string;
    checkTime: string;
    result: string;
    conclusion: string | null;
    reason: string | null;
    uploader: string;
  }>;
  businessAlerts: {
    frozenBatches: Array<{ id: string; code: string; reason: string | null; time: string }>;
    highLossTasks: Array<{ id: string; code: string; lossRate: number; lossCount: number; inputCount: number; time: string }>;
    uncalibratedMachines: Array<{ id: string; code: string; name: string }>;
    unbalancedTagClaims?: Array<{ id: string; code: string; farmerName: string; claimCount: number; accountedCount: number; diff: number; claimDate: string }>;
  };
}

const QC_CAT_MAP: Record<string, { label: string }> = {
  POOL_INSPECT: { label: "暂养巡检" },
  WATER_QUALITY: { label: "水质监测" },
  BUNDLE_INSPECT: { label: "捆扎巡检" },
  SORT_INSPECT: { label: "分拣巡检" },
  SORT_CALIBRATE: { label: "分拣校准" },
  COLD_TEMP: { label: "保鲜记录" },
  PACK_INSPECT: { label: "包装巡检" },
};

const DEFAULT_POOL_TEMPS: Record<string, number> = {
  "ZY-01": 20.2, "ZY-02": 19.8, "ZY-03": 20.5, "ZY-04": 21.0,
  "ZY-05": 23.6, "ZY-06": 24.8, "ZY-07": 20.1, "ZY-08": 25.4,
};

export function OverviewDashboard({ metrics, activePools, qcRecords, businessAlerts }: DashboardProps) {
  // -------------------------------------------------------------
  // ③ 温度状态管理（种子默认值）
  // -------------------------------------------------------------
  const [indoorTemp, setIndoorTemp] = useState<number>(23.8);

  const initialPoolTemps = useMemo(
    () => Object.fromEntries(activePools.map((p) => [p.code, DEFAULT_POOL_TEMPS[p.code] ?? 20.0])),
    [activePools]
  );

  const [poolTemps, setPoolTemps] = useState<Record<string, number>>(initialPoolTemps);

  const handlePoolTempChange = (code: string, val: string) => {
    const num = parseFloat(val);
    setPoolTemps((prev) => ({
      ...prev,
      [code]: isNaN(num) ? 0 : num,
    }));
  };

  // -------------------------------------------------------------
  // ④ 异常提醒聚合与分级
  // -------------------------------------------------------------
  const combinedExceptions = useMemo(() => {
    const list: Array<{
      id: string;
      level: "SEVERE" | "WARNING";
      category: "TEMPERATURE" | "QC" | "BUSINESS";
      catLabel: string;
      target: string;
      title: string;
      reason: string;
      time: string;
    }> = [];

    // 1. 室内温度
    if (indoorTemp > 28.0) {
      list.push({
        id: "temp-indoor-danger",
        level: "SEVERE",
        category: "TEMPERATURE",
        catLabel: "环境温控",
        target: "车间作业区",
        title: `室温严重超限 (${indoorTemp}℃ > 28℃)`,
        reason: "温度偏高会导致螃蟹异常情况变多，请加强通风降温与巡检频率",
        time: "实时监测",
      });
    } else if (indoorTemp >= 26.0) {
      list.push({
        id: "temp-indoor-warn",
        level: "WARNING",
        category: "TEMPERATURE",
        catLabel: "环境温控",
        target: "车间作业区",
        title: `室温偏高预警 (${indoorTemp}℃ ≥ 26℃)`,
        reason: "温度偏高会导致螃蟹异常情况变多，请加强增氧与巡检",
        time: "实时监测",
      });
    }

    // 2. 暂养池水温
    activePools.forEach((pool) => {
      const temp = poolTemps[pool.code] ?? 20.0;
      if (temp > 24.0) {
        list.push({
          id: `temp-pool-${pool.code}-danger`,
          level: "SEVERE",
          category: "TEMPERATURE",
          catLabel: "水温监控",
          target: `${pool.code} (${pool.name})`,
          title: `水温严重超阈 (${temp}℃ > 24℃)`,
          reason: "螃蟹异常风险高！温度偏高会导致螃蟹异常情况变多，请立即加强增氧与巡检",
          time: "实时监测",
        });
      } else if (temp >= 22.0) {
        list.push({
          id: `temp-pool-${pool.code}-warn`,
          level: "WARNING",
          category: "TEMPERATURE",
          catLabel: "水温监控",
          target: `${pool.code} (${pool.name})`,
          title: `水温偏高预警 (${temp}℃ ≥ 22℃)`,
          reason: "注意增氧！温度偏高会导致螃蟹异常情况变多，请加强增氧与巡检",
          time: "实时监测",
        });
      }
    });

    // 3. 业务预警
    businessAlerts.frozenBatches.forEach((b) => {
      list.push({
        id: `biz-frozen-${b.id}`,
        level: "SEVERE",
        category: "BUSINESS",
        catLabel: "批次风控",
        target: b.code,
        title: "原料批次被安全锁定冻结",
        reason: b.reason || "品控复检待确认，严禁进入捆扎及后续环节",
        time: b.time ? new Date(b.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "今日",
      });
    });

    businessAlerts.uncalibratedMachines.forEach((m) => {
      list.push({
        id: `biz-machine-${m.id}`,
        level: "SEVERE",
        category: "BUSINESS",
        catLabel: "设备联锁",
        target: `${m.name} (${m.code})`,
        title: "动态分拣设备精度校验未通过",
        reason: "传感器误差超标，联锁已强制停机，禁止派发分拣任务",
        time: "今日早班",
      });
    });

    businessAlerts.highLossTasks.forEach((t) => {
      list.push({
        id: `biz-loss-${t.id}`,
        level: "WARNING",
        category: "BUSINESS",
        catLabel: "损耗超标",
        target: t.code,
        title: `分拣损耗率超 5% 警戒线 (${t.lossRate}%)`,
        reason: `投入 ${t.inputCount} 只，损耗 ${t.lossCount} 只，需核验绑扣及装卸环节`,
        time: t.time ? new Date(t.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "今日",
      });
    });

    businessAlerts.unbalancedTagClaims?.forEach((c) => {
      list.push({
        id: `biz-tag-${c.id}`,
        level: "WARNING",
        category: "BUSINESS",
        catLabel: "蟹扣日结",
        target: `${c.farmerName}`,
        title: `蟹扣日结未轧平 (差额 ${c.diff} 只)`,
        reason: `领扣 ${c.claimCount} 只，已核销 ${c.accountedCount} 只（绑扣/退回/作废），请及时完成日结轧平`,
        time: c.claimDate ? new Date(c.claimDate).toLocaleDateString("zh-CN") : "今日",
      });
    });

    // 4. 品控巡检
    qcRecords.forEach((q) => {
      if (q.result === "EXCEPTION") {
        const isResolved =
          (q.conclusion && (q.conclusion.includes("已整改") || q.conclusion.includes("已完成") || q.conclusion.includes("已闭环"))) ||
          false;

        list.push({
          id: `qc-${q.id}`,
          level: isResolved ? "WARNING" : "SEVERE",
          category: "QC",
          catLabel: QC_CAT_MAP[q.cat]?.label || "品控巡检",
          target: q.refId,
          title: q.title,
          reason: q.reason || q.conclusion || "指标异常需核查",
          time: new Date(q.checkTime).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        });
      }
    });

    return list.sort((a, b) => (a.level === "SEVERE" ? -1 : 1));
  }, [indoorTemp, poolTemps, activePools, qcRecords, businessAlerts]);

  const severeCount = combinedExceptions.filter((e) => e.level === "SEVERE").length;
  const warningCount = combinedExceptions.filter((e) => e.level === "WARNING").length;

  // -------------------------------------------------------------
  // 顶部自动轮播 Ticker 状态、定时器与悬停暂停
  // -------------------------------------------------------------
  const [tickerIndex, setTickerIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const totalExceptions = combinedExceptions.length;

  useEffect(() => {
    if (totalExceptions <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % totalExceptions);
    }, 3200);
    return () => clearInterval(timer);
  }, [totalExceptions, isPaused]);

  // -------------------------------------------------------------
  // 漏斗与巡检进度条动画状态
  // -------------------------------------------------------------
  const [funnelMounted, setFunnelMounted] = useState<boolean>(false);
  useEffect(() => setFunnelMounted(true), []);

  // -------------------------------------------------------------
  // ⑥ 巡检异常环节分布统计
  // -------------------------------------------------------------
  const qcDistribution = useMemo(() => {
    const counts: Record<string, { total: number; exceptions: number }> = {};
    qcRecords.forEach((q) => {
      if (!counts[q.cat]) counts[q.cat] = { total: 0, exceptions: 0 };
      counts[q.cat].total += 1;
      if (q.result === "EXCEPTION") counts[q.cat].exceptions += 1;
    });
    return [
      "POOL_INSPECT",
      "WATER_QUALITY",
      "BUNDLE_INSPECT",
      "SORT_INSPECT",
      "SORT_CALIBRATE",
      "COLD_TEMP",
      "PACK_INSPECT",
    ].map((cat) => ({
      key: cat,
      label: QC_CAT_MAP[cat]?.label || cat,
      total: counts[cat]?.total || 0,
      exceptions: counts[cat]?.exceptions || 0,
      hasException: (counts[cat]?.exceptions || 0) > 0,
    }));
  }, [qcRecords]);

  // -------------------------------------------------------------
  // ⑤ 数量闭环漏斗四级数据
  // -------------------------------------------------------------
  const funnelSteps = [
    {
      level: "1. 签约核定额度",
      value: metrics.totalQuota,
      percentage: 100,
      gate: "源头额度卡控（≤ 600只/亩）",
      bgBar: "bg-indigo-500",
      textColor: "text-indigo-600 dark:text-indigo-400",
      delay: 0,
    },
    {
      level: "2. 原料实际入池",
      value: metrics.totalInPool,
      percentage: metrics.totalQuota > 0 ? (metrics.totalInPool / metrics.totalQuota) * 100 : 0,
      gate: "一码单多规格实录入池",
      bgBar: "bg-sky-500",
      textColor: "text-sky-600 dark:text-sky-400",
      delay: 150,
    },
    {
      level: "3. 蟹扣合规申领",
      value: metrics.totalTagClaimed,
      percentage: metrics.totalQuota > 0 ? (metrics.totalTagClaimed / metrics.totalQuota) * 100 : 0,
      gate: "在池存活余量与额度双卡控",
      bgBar: "bg-amber-500",
      textColor: "text-amber-600 dark:text-amber-400",
      delay: 300,
    },
    {
      level: "4. 最终出库发运",
      value: metrics.totalOutboundCount,
      percentage: metrics.totalQuota > 0 ? (metrics.totalOutboundCount / metrics.totalQuota) * 100 : 0,
      gate: "单票匹配冷库锁鲜库存",
      bgBar: "bg-emerald-500",
      textColor: "text-emerald-600 dark:text-emerald-400",
      delay: 450,
    },
  ];

  return (
    <StaggerContainer className="flex flex-col gap-4">
      {/* ========================================================= */}
      {/* ① 顶部自动垂直轮播广播条（悬停自动暂停，平滑位移动画）      */}
      {/* ========================================================= */}
      <FadeIn direction="down">
        <div className="h-10 px-3 rounded-lg border bg-card/90 shadow-2xs text-xs flex items-center justify-between gap-3 overflow-hidden backdrop-blur-xs">
          {/* 左侧：广播徽标与严重/预警计数 */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[11px]">
              <Radio className="size-3 animate-pulse" />
              <span>实时风控广播</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px]">
              {severeCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-destructive/15 text-destructive font-bold animate-in fade-in duration-200">
                  {severeCount} 严重
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium animate-in fade-in duration-200">
                  {warningCount} 预警
                </span>
              )}
            </div>
          </div>

          {/* 中间：自动垂直位移轮播视口 (固定 28px 高度，平滑过渡) */}
          <div
            className="flex-1 h-7 overflow-hidden relative"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {totalExceptions === 0 ? (
              <div className="h-7 flex items-center text-emerald-600 gap-1 text-[11px]">
                <CheckCircle2 className="size-3.5" /> 各环节巡检指标、水温环境与批次流转均在合规受控范围内。
              </div>
            ) : (
              <div
                className="transition-transform duration-500 ease-in-out flex flex-col will-change-transform"
                style={{ transform: `translateY(-${tickerIndex * 28}px)` }}
              >
                {combinedExceptions.map((item) => (
                  <div
                    key={item.id}
                    className="h-7 flex items-center gap-2 text-[11px] truncate shrink-0"
                  >
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded text-[10px] font-bold font-mono shrink-0 shadow-2xs",
                        item.level === "SEVERE"
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-amber-500 text-white"
                      )}
                    >
                      {item.level === "SEVERE" ? "严重" : "预警"}
                    </span>
                    <span className="font-mono text-muted-foreground shrink-0">[{item.time}]</span>
                    <span className="font-bold text-foreground shrink-0">{item.target}:</span>
                    <span className="text-foreground truncate">{item.title}</span>
                    <span className="text-muted-foreground hidden md:inline truncate">
                      — {item.reason}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右侧：‹ › 切换按钮与追溯快捷入口 */}
          <div className="flex items-center gap-1 shrink-0 pl-2">
            {totalExceptions > 1 && (
              <div className="flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground mr-2">
                <button
                  type="button"
                  onClick={() => setTickerIndex((prev) => (prev - 1 + totalExceptions) % totalExceptions)}
                  className="p-1 hover:bg-muted active:scale-95 rounded transition-all"
                  title="上一条"
                >
                  <ChevronLeft className="size-3" />
                </button>
                <span>
                  {tickerIndex + 1}/{totalExceptions}
                </span>
                <button
                  type="button"
                  onClick={() => setTickerIndex((prev) => (prev + 1) % totalExceptions)}
                  className="p-1 hover:bg-muted active:scale-95 rounded transition-all"
                  title="下一条"
                >
                  <ChevronRight className="size-3" />
                </button>
              </div>
            )}
            <Link href="/trace">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] gap-1 text-primary hover:bg-primary/10 active:scale-95 transition-all">
                <FileSearch className="size-3" />
                全链追溯
              </Button>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* ========================================================= */}
      {/* ② 全链路一体化工序流（统一无缝大卡片，内分 8 格）          */}
      {/* ========================================================= */}
      <FadeIn>
        <div className="rounded-xl border bg-card shadow-2xs overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 divide-x-0 md:divide-x border-b border-border/70">
            {/* 1. 订单 */}
            <div className="p-3.5 flex flex-col justify-between hover:bg-muted/20 active:scale-[0.99] transition-all duration-150 group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="size-4.5 rounded flex items-center justify-center bg-blue-500/10 text-blue-600 font-mono text-[10px] font-bold group-hover:bg-blue-500 group-hover:text-white transition-colors">1</span>
                  订单需求
                </span>
                <ShoppingCart className="size-3.5 text-blue-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="my-1">
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  <AnimatedNumber value={metrics.todayOrdersCount} duration={700} />
                  <span className="text-xs text-muted-foreground font-normal ml-1">单</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  待发货：<span className="font-mono font-medium text-foreground"><AnimatedNumber value={metrics.pendingDeliveryTotalCount} duration={700} /></span> 只
                </div>
              </div>
              <div className="pt-2 border-t border-dashed text-[10px] text-muted-foreground flex justify-between">
                <span>累计订单</span>
                <span className="font-mono font-medium text-foreground">{metrics.totalOrdersCount} 单</span>
              </div>
            </div>

            {/* 2. 原料 */}
            <div className="p-3.5 flex flex-col justify-between hover:bg-muted/20 active:scale-[0.99] transition-all duration-150 group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="size-4.5 rounded flex items-center justify-center bg-sky-500/10 text-sky-600 font-mono text-[10px] font-bold group-hover:bg-sky-500 group-hover:text-white transition-colors">2</span>
                  原料到货
                </span>
                <Layers className="size-3.5 text-sky-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="my-1">
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  <AnimatedNumber value={metrics.todayBatchesCount} duration={700} />
                  <span className="text-xs text-muted-foreground font-normal ml-1">批</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  今日到货：<span className="font-mono font-medium text-foreground"><AnimatedNumber value={metrics.todayInPoolTotalCount} duration={700} /></span> 只
                </div>
              </div>
              <div className="pt-2 border-t border-dashed text-[10px] text-muted-foreground flex justify-between">
                <span>累计入池</span>
                <span className="font-mono font-medium text-foreground">{metrics.totalBatchesCount} 批</span>
              </div>
            </div>

            {/* 3. 蟹扣申领 */}
            <div className="p-3.5 flex flex-col justify-between hover:bg-muted/20 active:scale-[0.99] transition-all duration-150 group relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="size-4.5 rounded flex items-center justify-center bg-amber-500/10 text-amber-600 font-mono text-[10px] font-bold group-hover:bg-amber-500 group-hover:text-white transition-colors">3</span>
                  蟹扣申领
                </span>
                {metrics.pendingTagClaimsCount > 0 ? (
                  <PulseBadge color="amber" className="text-[10px] font-mono bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded">
                    待审批 {metrics.pendingTagClaimsCount}
                  </PulseBadge>
                ) : (
                  <Tag className="size-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                )}
              </div>
              <div className="my-1">
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  <AnimatedNumber value={metrics.todayTagClaimsCount} duration={700} />
                  <span className="text-xs text-muted-foreground font-normal ml-1">单</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  申领总数：<span className="font-mono font-medium text-foreground"><AnimatedNumber value={metrics.todayTagClaimsTotalCount} duration={700} /></span> 只
                </div>
              </div>
              <div className="pt-2 border-t border-dashed text-[10px] text-muted-foreground flex justify-between">
                <span>累计已核发</span>
                <span className="font-mono font-medium text-foreground">{metrics.totalTagClaimsCount.toLocaleString()} 只</span>
              </div>
            </div>

            {/* 4. 暂养 */}
            <div className="p-3.5 flex flex-col justify-between hover:bg-muted/20 active:scale-[0.99] transition-all duration-150 group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="size-4.5 rounded flex items-center justify-center bg-cyan-500/10 text-cyan-600 font-mono text-[10px] font-bold group-hover:bg-cyan-500 group-hover:text-white transition-colors">4</span>
                  暂养在池
                </span>
                <Waves className="size-3.5 text-cyan-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="my-1">
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  <AnimatedNumber value={metrics.todayPoolInCount} duration={700} />
                  <span className="text-xs text-muted-foreground font-normal ml-1">只入池</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  在养池数：<span className="font-mono font-medium text-foreground">{metrics.activePoolsCount}</span> 个池在养
                </div>
              </div>
              <div className="pt-2 border-t border-dashed text-[10px] text-muted-foreground flex justify-between">
                <span>实时在池存活</span>
                <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                  <AnimatedNumber value={metrics.totalLiveInPoolCount} duration={700} /> 只
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 divide-x-0 md:divide-x">
            {/* 5. 捆扎 */}
            <div className="p-3.5 flex flex-col justify-between hover:bg-muted/20 active:scale-[0.99] transition-all duration-150 group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="size-4.5 rounded flex items-center justify-center bg-indigo-500/10 text-indigo-600 font-mono text-[10px] font-bold group-hover:bg-indigo-500 group-hover:text-white transition-colors">5</span>
                  捆扎绑扣
                </span>
                <PackageCheck className="size-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="my-1">
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  <AnimatedNumber value={metrics.todayBundleBatchesCount} duration={700} />
                  <span className="text-xs text-muted-foreground font-normal ml-1">批</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  捆扎总数：<span className="font-mono font-medium text-foreground"><AnimatedNumber value={metrics.todayBundleTotalCount} duration={700} /></span> 只 (完工 {metrics.todayBundleDoneCount} 批)
                </div>
              </div>
              <div className="pt-2 border-t border-dashed text-[10px] text-muted-foreground flex justify-between">
                <span>累计捆扎批次</span>
                <span className="font-mono font-medium text-foreground">{metrics.totalBundleBatchesCount} 批</span>
              </div>
            </div>

            {/* 6. 分拣 */}
            <div className="p-3.5 flex flex-col justify-between hover:bg-muted/20 active:scale-[0.99] transition-all duration-150 group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="size-4.5 rounded flex items-center justify-center bg-purple-500/10 text-purple-600 font-mono text-[10px] font-bold group-hover:bg-purple-500 group-hover:text-white transition-colors">6</span>
                  动态分拣
                </span>
                <Cpu className="size-3.5 text-purple-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="my-1">
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  <AnimatedNumber value={metrics.todaySortTasksCount} duration={700} />
                  <span className="text-xs text-muted-foreground font-normal ml-1">任务</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  合格 <span className="font-mono font-medium text-emerald-600"><AnimatedNumber value={metrics.todaySortQualifiedCount} duration={700} /></span> · 损耗{" "}
                  <span className="font-mono font-medium text-destructive"><AnimatedNumber value={metrics.todaySortLossCount} duration={700} /></span>
                </div>
              </div>
              <div className="pt-2 border-t border-dashed text-[10px] text-muted-foreground flex justify-between">
                <span>累计分拣任务</span>
                <span className="font-mono font-medium text-foreground">{metrics.totalSortTasksCount} 个</span>
              </div>
            </div>

            {/* 7. 预冷 */}
            <div className="p-3.5 flex flex-col justify-between hover:bg-muted/20 active:scale-[0.99] transition-all duration-150 group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="size-4.5 rounded flex items-center justify-center bg-teal-500/10 text-teal-600 font-mono text-[10px] font-bold group-hover:bg-teal-500 group-hover:text-white transition-colors">7</span>
                  保鲜预冷
                </span>
                <ThermometerSnowflake className="size-3.5 text-teal-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="my-1">
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  <AnimatedNumber value={metrics.todayColdIntakeCount} duration={700} />
                  <span className="text-xs text-muted-foreground font-normal ml-1">只入库</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  保鲜库区：<span className="font-mono font-medium text-foreground">{metrics.activeColdStoresCount}</span> 个库运行中
                </div>
              </div>
              <div className="pt-2 border-t border-dashed text-[10px] text-muted-foreground flex justify-between">
                <span>当前锁鲜库存</span>
                <span className="font-mono font-semibold text-teal-600 dark:text-teal-400">
                  <AnimatedNumber value={metrics.totalColdStockCount} duration={700} /> 只
                </span>
              </div>
            </div>

            {/* 8. 出库 */}
            <div className="p-3.5 flex flex-col justify-between hover:bg-muted/20 active:scale-[0.99] transition-all duration-150 group relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="size-4.5 rounded flex items-center justify-center bg-emerald-500/10 text-emerald-600 font-mono text-[10px] font-bold group-hover:bg-emerald-500 group-hover:text-white transition-colors">8</span>
                  出库发运
                </span>
                {metrics.pendingOutboundOrdersCount > 0 ? (
                  <PulseBadge color="amber" className="text-[10px] font-mono bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded">
                    待审核 {metrics.pendingOutboundOrdersCount}
                  </PulseBadge>
                ) : (
                  <Truck className="size-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
                )}
              </div>
              <div className="my-1">
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  <AnimatedNumber value={metrics.todayOutboundOrdersCount} duration={700} />
                  <span className="text-xs text-muted-foreground font-normal ml-1">单</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  今日发运：<span className="font-mono font-medium text-foreground"><AnimatedNumber value={metrics.todayOutboundTotalCount} duration={700} /></span> 只
                </div>
              </div>
              <div className="pt-2 border-t border-dashed text-[10px] text-muted-foreground flex justify-between">
                <span>累计合规出库</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  <AnimatedNumber value={metrics.totalOutboundCount} duration={700} /> 只
                </span>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* ========================================================= */}
      {/* ③ 下半区：双栏一体化架构                                  */}
      {/* 左栏 (58%)：异常预警中心 + 环境水温态势                     */}
      {/* 右栏 (42%)：数量闭环漏斗 + 品控巡检健康度                   */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ======================================================= */}
        {/* 左栏 (运营与风控中枢)                                    */}
        {/* ======================================================= */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* 1. 全链路异常与风控预警中心 */}
          <FadeIn>
            <Card className="border-border/80 shadow-xs flex flex-col bg-card overflow-hidden">
              <CardHeader className="py-2.5 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="size-4 text-destructive" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                    全链路异常与风控预警中心
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <Badge variant="destructive" className="py-0 px-2 text-[10px]">
                    {severeCount} 严重
                  </Badge>
                  <Badge variant="outline" className="py-0 px-2 text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/40">
                    {warningCount} 预警
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-3">
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                  {combinedExceptions.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="size-7 text-emerald-500 animate-in zoom-in-50 duration-300" />
                      <span>系统全链路未发现任何超阈告警或异常指标。</span>
                    </div>
                  ) : (
                    combinedExceptions.map((ex) => (
                      <div
                        key={ex.id}
                        className={cn(
                          "p-2 rounded-r-lg border-y border-r text-xs flex flex-col gap-1 transition-all pl-2.5",
                          ex.level === "SEVERE"
                            ? "border-l-3 border-l-destructive bg-destructive/5 hover:bg-destructive/10 border-border/70 shadow-2xs"
                            : "border-l-3 border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10 border-border/70 shadow-2xs"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-[9px] font-bold px-1.5 py-0.2 rounded font-mono",
                                ex.level === "SEVERE"
                                  ? "bg-destructive text-destructive-foreground"
                                  : "bg-amber-500 text-white dark:text-zinc-950"
                              )}
                            >
                              {ex.level === "SEVERE" ? "严重" : "预警"}
                            </span>
                            <span className="text-[11px] font-semibold text-foreground">
                              {ex.catLabel} · {ex.target}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">{ex.time}</span>
                        </div>

                        <div className="font-medium text-foreground text-[11px]">{ex.title}</div>

                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          {ex.reason}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>留痕机制：双时间戳自动上链不可篡改</span>
                  <Link href="/ledgers" className="text-primary hover:underline flex items-center gap-0.5 group">
                    查看 12 类合规台账 <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* 2. 环境与水温监控矩阵 */}
          <FadeIn>
            <Card className="border-border/80 shadow-xs bg-card overflow-hidden">
              <CardHeader className="py-2 px-4 border-b bg-muted/20 flex flex-row items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Thermometer className="size-4 text-primary" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                    环境与暂养水温监控（态势矩阵）
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-background text-muted-foreground border-border font-normal">
                    手填报数 · 预留物联网自动采集
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-stretch">
                  {/* 室温仪表 (3列宽，更紧凑精致) */}
                  <div className={cn(
                    "md:col-span-3 p-3 rounded-lg border flex flex-col justify-between transition-all duration-300",
                    indoorTemp > 28
                      ? "border-destructive/60 bg-destructive/10 ring-1 ring-destructive/30"
                      : indoorTemp >= 26
                      ? "border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/20"
                      : "border-border/80 bg-muted/20"
                  )}>
                    <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Wind className="size-3.5 text-primary" />
                        作业区室温
                      </div>
                      <span className={cn(
                        "size-2 rounded-full transition-colors duration-300",
                        indoorTemp > 28 ? "bg-destructive animate-ping" : indoorTemp >= 26 ? "bg-amber-500" : "bg-emerald-500"
                      )} />
                    </div>

                    <div className="my-2 flex flex-col items-center justify-center">
                      <div className="flex items-baseline justify-center gap-0.5">
                        <Input
                          type="number"
                          step="0.1"
                          value={indoorTemp}
                          onChange={(e) => setIndoorTemp(parseFloat(e.target.value) || 0)}
                          className="h-8 w-20 bg-transparent hover:bg-muted/50 focus:bg-background border-transparent hover:border-border/60 focus:border-ring shadow-none text-center font-mono font-black text-xl px-0 py-0 focus:ring-1 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-sm font-semibold text-muted-foreground">℃</span>
                      </div>
                      <div className="text-[10px] font-semibold transition-colors duration-300 mt-1">
                        {indoorTemp > 28 ? (
                          <span className="text-destructive font-bold">严重超限 (≤26℃标控)</span>
                        ) : indoorTemp >= 26 ? (
                          <span className="text-amber-600 font-bold">偏高预警 (≤26℃标控)</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">环境适宜 (≤26℃标控)</span>
                        )}
                      </div>
                    </div>

                    <div className="text-[10px] text-muted-foreground pt-1.5 border-t border-border/40 text-center">
                      分拣称重与捆扎作业环境
                    </div>
                  </div>

                  {/* 8个暂养池 4x2 宽裕态势矩阵 (9列宽，每个池获得充足呼吸感) */}
                  <div className="md:col-span-9 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {activePools.map((pool) => {
                      const temp = poolTemps[pool.code] ?? 20.0;
                      const isSevere = temp > 24.0;
                      const isWarn = temp >= 22.0 && temp <= 24.0;

                      return (
                        <div
                          key={pool.id}
                          className={cn(
                            "p-2.5 rounded-lg border flex flex-col justify-between transition-all duration-300 hover:shadow-xs",
                            isSevere
                              ? "border-destructive/60 bg-destructive/10 ring-1 ring-destructive/30"
                              : isWarn
                              ? "border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/20"
                              : "border-border/70 bg-muted/20 hover:border-border"
                          )}
                        >
                          {/* 顶栏：池号 + 规格 + 状态指示灯 */}
                          <div className="flex items-center justify-between text-xs pb-1 border-b border-border/40">
                            <div className="flex items-center gap-1.5 font-mono font-bold text-foreground">
                              <span>{pool.code}</span>
                              <span className="text-[10px] font-normal text-muted-foreground">
                                {pool.currentWeightTier ? `${pool.currentGender === "FEMALE" ? "母" : "公"}${pool.currentWeightTier}` : "空池"}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "size-1.5 rounded-full transition-colors duration-300 shrink-0",
                                isSevere ? "bg-destructive animate-ping" : isWarn ? "bg-amber-500" : "bg-emerald-500"
                              )}
                            />
                          </div>

                          {/* 中栏：大字号水温 Hero Display (居中通透，隐形编辑) */}
                          <div className="my-1.5 flex items-baseline justify-center gap-0.5">
                            <Input
                              type="number"
                              step="0.1"
                              value={temp}
                              onChange={(e) => handlePoolTempChange(pool.code, e.target.value)}
                              className="h-7 w-16 bg-transparent hover:bg-muted/50 focus:bg-background border-transparent hover:border-border/60 focus:border-ring shadow-none text-center font-mono font-black text-base px-0 py-0 focus:ring-1 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-xs font-semibold text-muted-foreground">℃</span>
                          </div>

                          {/* 底栏：在池数量 + 状态简标 */}
                          <div className="pt-1 border-t border-border/40 flex items-center justify-between text-[10px]">
                            <span className="font-mono text-muted-foreground">
                              {pool.liveCount.toLocaleString()}只
                            </span>
                            <span className="font-medium">
                              {isSevere ? (
                                <span className="text-destructive font-bold">⚠️ 超阈</span>
                              ) : isWarn ? (
                                <span className="text-amber-700 dark:text-amber-400 font-semibold">注意增氧</span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-500">正常 ≤22℃</span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </div>

        {/* ======================================================= */}
        {/* 右栏 (合规与品质中枢)                                    */}
        {/* ======================================================= */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* 1. 数量闭环收敛漏斗 */}
          <FadeIn>
            <Card className="border-border/80 shadow-xs bg-card overflow-hidden">
              <CardHeader className="py-2.5 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                    数量闭环收敛漏斗
                  </CardTitle>
                </div>
                <span className="text-[10px] font-mono text-emerald-600 font-semibold">
                  守恒状态: 100% 闭环
                </span>
              </CardHeader>
              <CardContent className="p-3.5 space-y-3">
                <div className="space-y-3">
                  {funnelSteps.map((step, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{step.level}</span>
                        <div className="font-mono text-right">
                          <strong className={cn("text-xs", step.textColor)}>
                            <AnimatedNumber value={step.value} duration={800} />
                          </strong>
                          <span className="text-[10px] text-muted-foreground ml-0.5">只</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5 font-semibold">
                            ({step.percentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-700 ease-out", step.bgBar)}
                          style={{
                            width: funnelMounted ? `${Math.max(4, Math.min(100, step.percentage))}%` : "0%",
                            transitionDelay: `${step.delay}ms`,
                          }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground flex justify-between">
                        <span>卡口：{step.gate}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t text-center">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium animate-in fade-in duration-500">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    全链路数量守恒，当前无越级数据
                  </div>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* 2. 巡检环节健康度 */}
          <FadeIn>
            <Card className="border-border/80 shadow-xs bg-card overflow-hidden">
              <CardHeader className="py-2.5 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-primary" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider">
                    品控巡检环节健康度
                  </CardTitle>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  7 大品控环节
                </span>
              </CardHeader>
              <CardContent className="p-3.5 space-y-2">
                <div className="space-y-2 text-xs">
                  {qcDistribution.map((item) => {
                    return (
                      <div key={item.key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-foreground">{item.label}</span>
                          <div className="font-mono text-[10px]">
                            {item.hasException ? (
                              <span className="text-destructive font-bold animate-pulse">
                                {item.exceptions} 异常 / {item.total} 记录 (需复检)
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                100% 合格 ({item.total} 记录)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              item.hasException ? "bg-destructive" : "bg-emerald-500/50"
                            )}
                            style={{
                              width: funnelMounted ? (item.total === 0 ? "0%" : "100%") : "0%",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </div>
    </StaggerContainer>
  );
}
