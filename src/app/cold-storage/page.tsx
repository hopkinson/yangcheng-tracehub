import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColdIntakeDialog } from "@/components/coldStore/ColdIntakeDialog";
import { ColdStoreDialog } from "@/components/coldStore/ColdStoreDialog";
import { QCRecordDialog } from "@/components/qc/QCRecordDialog";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { ThermometerSnowflake, CheckSquare, Plus, Activity, ShieldCheck, AlertTriangle } from "lucide-react";
import { formatISODate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ColdStoragePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params?.page) || 1);
  const pageSize = Math.max(1, Number(params?.pageSize) || 10);
  // 1. 查询保鲜库及其入库流水
  const stores = await prisma.coldStore.findMany({
    orderBy: { code: "asc" },
    include: {
      _count: { select: { logs: true } },
      logs: {
        include: {
          outboundOrders: {
            where: { status: { not: "REJECTED" } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // 2. 查询全部入库流水
  const logs = await prisma.coldLog.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      store: true,
      outboundOrders: {
        where: { status: { not: "REJECTED" } },
      },
    },
  });

  // 2.5 查询已生效的出库明细，精确按规格核销预冷在库余量
  const activeOutboundLines = await prisma.outboundLine.findMany({
    where: { outboundOrder: { status: { not: "REJECTED" } } },
    select: { gender: true, weightTier: true, count: true },
  });

  // 3. 查询保鲜库温湿度质检监控记录 (13.4)
  const qcRecords = await prisma.qCRecord.findMany({
    where: { cat: "COLD_TEMP" },
    orderBy: { checkTime: "desc" },
  });

  // 4. 查询已完成分拣任务并统计预冷入库余量 (基于分拣批次入库与数量卡控)
  const completedSortTasks = await prisma.sortTask.findMany({
    where: { status: "COMPLETED" },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const sortTaskOptions = completedSortTasks.map((t) => {
    const taskLogs = logs.filter((l) => l.refId === t.code || l.refId === t.id);
    const alreadyIntakeCount = taskLogs.reduce((acc, l) => acc + l.count, 0);
    const availableCount = Math.max(0, t.qualifiedCount - alreadyIntakeCount);
    return {
      id: t.id,
      code: t.code,
      gender: t.gender,
      weightTier: t.weightTier,
      qualifiedCount: t.qualifiedCount,
      alreadyIntakeCount,
      availableCount,
    };
  });

  const taskMap = new Map(sortTaskOptions.flatMap((t) => [[t.code, t], [t.id, t]]));

  // 按规格聚合总出库消耗
  const specOutboundMap = activeOutboundLines.reduce((map, line) => {
    const key = `${line.gender}_${line.weightTier}`;
    return map.set(key, (map.get(key) || 0) + line.count);
  }, new Map<string, number>());

  // 为每个 ColdLog 计算 FIFO 核销出库量 (从最早的入库批次开始消耗)
  const sortedLogs = [...logs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const logUsedMap = new Map<string, number>();
  const remainingSpecOutbound = new Map(specOutboundMap);

  for (const l of sortedLogs) {
    const task = taskMap.get(l.refId || "");
    if (!task) continue;
    const key = `${task.gender}_${task.weightTier}`;
    const needed = remainingSpecOutbound.get(key) || 0;
    const usedForThisLog = Math.min(l.count, needed);
    logUsedMap.set(l.id, usedForThisLog);
    remainingSpecOutbound.set(key, needed - usedForThisLog);
  }

  const storeOptions = stores.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    targetTemp: s.targetTemp,
  }));

  // 获取今日日期字符串用于统计今日入库 (兼容仿真固定日期 2026-09-21 或真实当天)
  const todayStr = formatISODate();

  const totalStoredCount = logs.reduce((a, b) => a + b.count, 0);
  const totalOutboundUsed = Array.from(logUsedMap.values()).reduce((a, b) => a + b, 0);
  const totalInStockCount = Math.max(0, totalStoredCount - totalOutboundUsed);
  const paginatedLogs = logs.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4">
      {/* 头部标题与操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ThermometerSnowflake className="size-5 text-primary" />
            保鲜预冷
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            分拣合格成品大闸蟹入库预冷（4~5℃），严格【只入不出】，出库发货统一经由「出库管理」集中办理。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ColdStoreDialog stores={stores} />
          <ColdIntakeDialog stores={storeOptions} sortTasks={sortTaskOptions} />
        </div>
      </div>

      {/* 方案 A: Tab 标签分流工作台 */}
      <Tabs defaultValue="intake" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b pb-2">
          <TabsList className="h-9 p-1">
            <TabsTrigger value="intake" className="gap-1.5 text-xs">
              <CheckSquare className="size-3.5" />
              预冷入库流水
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                {logs.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="stores" className="gap-1.5 text-xs">
              <ThermometerSnowflake className="size-3.5" />
              库位状态监控
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                {stores.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="qc" className="gap-1.5 text-xs">
              <Activity className="size-3.5" />
              温湿度质检留痕
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                {qcRecords.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span>
              当前在库: <b className="text-emerald-600 dark:text-emerald-400">{totalInStockCount.toLocaleString()}</b> 只
            </span>
            <span>·</span>
            <span>
              累计入库: <b className="text-foreground">{totalStoredCount.toLocaleString()}</b> 只
            </span>
          </div>
        </div>

        {/* Tab 2: 保鲜库卡片监控 */}
        <TabsContent value="stores" className="m-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {stores.map((s) => {
              const totalStored = s.logs.reduce((a, b) => a + b.count, 0);
              const totalOutbound = s.logs.reduce((acc, l) => acc + (logUsedMap.get(l.id) || 0), 0);
              const currentStock = Math.max(0, totalStored - totalOutbound);
              // 今日入库计算 (当天的入库量，若无则取最近一天数据呈现)
              const todayStored = s.logs
                .filter((l) => formatISODate(l.createdAt) === todayStr || formatISODate(l.createdAt) === "2026-09-21")
                .reduce((a, b) => a + b.count, 0);
              const hasStock = currentStock > 0;

              return (
                <Card key={s.id} className="border-border/80 shadow-xs">
                  <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20 flex flex-row items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ThermometerSnowflake className="size-4 text-primary shrink-0" />
                      <CardTitle className="text-xs font-semibold truncate" title={`${s.name} (${s.code})`}>
                        {s.name} <span className="font-mono font-normal text-muted-foreground">({s.code})</span>
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono">
                        {s.targetTemp}℃
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          hasStock
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {hasStock ? "在库" : "空置"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-3">
                    {/* 核心在库主指标 */}
                    <div className="flex items-baseline justify-between pt-0.5">
                      <span className="text-xs text-muted-foreground">当前在库余量</span>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-2xl font-bold font-mono tracking-tight ${
                            hasStock
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {currentStock.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">只</span>
                      </div>
                    </div>

                    {/* 辅助流水指标 (单行不折行) */}
                    <div className="grid grid-cols-3 gap-1 py-2 px-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">今日入库</span>
                        <span className="font-semibold text-primary">+{todayStored.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">累计入库</span>
                        <span className="font-medium text-foreground">{totalStored.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">已出库核销</span>
                        <span className="font-medium text-muted-foreground">{totalOutbound.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* 卡片入库登记按钮 */}
                    <ColdIntakeDialog
                      stores={storeOptions}
                      sortTasks={sortTaskOptions}
                      defaultStoreId={s.id}
                      trigger={
                        <Button variant="outline" size="sm" className="w-full h-8 text-xs font-medium gap-1.5 shadow-2xs">
                          <Plus className="size-3.5 text-primary" />
                          入库登记到本库
                        </Button>
                      }
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

    {/* Tab 1: 保鲜预冷入库流水台账 */}
    <TabsContent value="intake" className="m-0 space-y-4">
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="py-3 px-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">保鲜预冷入库流水台账（共 {logs.length} 笔）</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-mono">
              <tr>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[150px]">入库单号 (CR)</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[140px]">入库时间</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[150px]">存入保鲜库</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[150px]">入库数量</th>
                <th className="px-3 py-2.5 font-medium min-w-[200px]">关联作业批次 / 任务</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[120px]">操作经手人</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    暂无入库记录，请点击上方「保鲜入库登记 (CR)」
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const logUsed = logUsedMap.get(log.id) || 0;
                  return (
                    <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2.5 font-mono font-bold text-foreground whitespace-nowrap">
                        {log.code}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                        {log.createdAt.toISOString().slice(5, 16).replace("T", " ")}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] font-mono font-medium px-1.5 py-0 h-4">
                          {log.store.code}
                        </Badge>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[130px]" title={log.store.name}>
                          {log.store.name}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-primary whitespace-nowrap">
                        +{log.count.toLocaleString()} 只
                        {logUsed > 0 && (
                          <span className="block text-[10px] font-normal text-muted-foreground">
                            在库 {Math.max(0, log.count - logUsed).toLocaleString()} 只 · 出库 {logUsed.toLocaleString()} 只
                          </span>
                        )}
                      </td>
                    <td className="px-3 py-2.5">
                      {log.refId ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] bg-muted/40 font-mono">
                            {log.refId}
                          </Badge>
                          {taskMap.get(log.refId) && (
                            <span className="text-[11px] text-muted-foreground">
                              ({taskMap.get(log.refId)!.gender === "FEMALE" ? "母蟹" : "公蟹"} {taskMap.get(log.refId)!.weightTier})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-mono">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {log.operator}
                    </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4 border-t">
          <DataTablePagination total={logs.length} page={page} pageSize={pageSize} />
        </div>
      </Card>
    </TabsContent>

    {/* Tab 3: 保鲜记录（保鲜库温湿度质检监控） */}
    <TabsContent value="qc" className="m-0 space-y-4">
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="py-3 px-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">保鲜库温湿度监控巡检记录（共 {qcRecords.length} 笔）</CardTitle>
          </div>
          <QCRecordDialog
            config={{
              cat: "COLD_TEMP",
              categoryLabel: "保鲜温湿度巡检",
              defaultTitle: "保鲜库温湿度监控记录表",
              formNoPreset: "YCGF-PZZX-202609",
              refType: "STORE",
              refId: stores[0]?.code || "BX-01",
              conclusions: [
                "温度 4.2℃，湿度 65%，冷风循环正常",
                "温度 4.5℃，湿度 68%，控温稳定",
                "温度 4.0℃，湿度 62%，运行良好",
                "温度超标 (>6℃)，制冷循环异常，已报修",
              ],
            }}
            triggerLabel="登记保鲜巡检 (202609)"
          />
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-mono">
              <tr>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[150px]">质检单号</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[130px]">巡检库位</th>
                <th className="px-3 py-2.5 font-medium min-w-[220px]">温湿度与巡检结论</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[110px]">状态</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[140px]">巡检时间</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[120px]">质检员</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {qcRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    暂无保鲜库温湿度记录
                  </td>
                </tr>
              ) : (
                qcRecords.map((qc) => {
                  const isQualified = qc.result === "QUALIFIED";
                  return (
                    <tr key={qc.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2.5 font-mono font-bold text-foreground whitespace-nowrap">
                        {qc.code}
                      </td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {qc.refId}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-foreground">
                        {qc.conclusion || "正常"}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] gap-1 ${
                            isQualified
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-destructive/10 text-destructive border-destructive/20"
                          }`}
                        >
                          {isQualified ? (
                            <>
                              <ShieldCheck className="size-3" />
                              合格
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="size-3" />
                              异常
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                        {qc.checkTime.toISOString().slice(5, 16).replace("T", " ")}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {qc.uploader}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </TabsContent>
  </Tabs>
</div>
  );
}
