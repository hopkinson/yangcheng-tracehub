import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SortTaskDialog } from "@/components/sorting/SortTaskDialog";
import { CompleteSortDialog } from "@/components/sorting/CompleteSortDialog";
import { SortTaskActions } from "@/components/sorting/SortTaskActions";
import { SortMachineDialog } from "@/components/sorting/SortMachineDialog";
import { MachineCardActions } from "@/components/sorting/MachineCardActions";
import { QCRecordDialog } from "@/components/qc/QCRecordDialog";
import { QCViewDialog } from "@/components/qc/QCViewDialog";
import {
  Scale,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Cpu,
  ClipboardCheck,
  ShieldAlert,
} from "lucide-react";
import { formatTime, formatShortDateTime, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const QC_PRESETS = {
  calibrate: {
    cat: "SORT_CALIBRATE" as const,
    categoryLabel: "分拣校准",
    defaultTitle: "分拣设备精度校验记录表",
    formNoPreset: "YCGF-PZZX-202607",
    refType: "MACHINE" as const,
    conclusions: [
      "50g/150g/200g 标准砝码校验误差均 <= +-1.5g，准予开机",
      "校验误差超限 (>+-3.0g)，需停机校正重新标定",
    ],
  },
  inspect: {
    cat: "SORT_INSPECT" as const,
    categoryLabel: "分拣巡检",
    defaultTitle: "分拣品质与车间巡检记录表",
    formNoPreset: "YCGF-PZZX-202608",
    refType: "WORKSHOP" as const,
    refId: "FJ-WORKSHOP",
    conclusions: [
      "分拣规格精准，落料无卡顿，品质抽检全部合格",
      "发现规格混入超标，已停机重新校验标定",
      "分拣破损率偏高，已通知班组检查落料斜槽",
    ],
  },
};

export default async function SortingPage() {
  // 1. 查询分拣设备列表
  const machines = await prisma.sortMachine.findMany({
    orderBy: { code: "asc" },
    include: {
      tasks: {
        orderBy: { date: "desc" },
      },
    },
  });

  // 2. 查询已完成捆扎批次 (status=COMPLETED) 及其关联分拣任务，精确计算各批次规格剩余待分拣只数
  const completedBundles = await prisma.bundleBatch.findMany({
    where: { status: "COMPLETED" },
    orderBy: { date: "desc" },
    include: {
      group: true,
      lines: { include: { pool: true } },
      sortTasks: true,
    },
  });

  const completedBundleOptions = completedBundles.map((b: any) => {
    const specUsed = new Map<string, number>();
    for (const t of b.sortTasks) {
      const key = `${t.gender}_${t.weightTier}`;
      specUsed.set(key, (specUsed.get(key) || 0) + t.inputCount);
    }

    let totalAvailable = 0;
    let totalQualified = 0;

    const lines = b.lines.map((l: any) => {
      const key = `${l.gender}_${l.weightTier}`;
      const totalCount = l.qualifiedCount ?? l.count;
      const used = specUsed.get(key) || 0;
      const consumed = Math.min(used, totalCount);
      specUsed.set(key, used - consumed);
      const availableCount = totalCount - consumed;

      totalAvailable += availableCount;
      totalQualified += totalCount;

      return {
        id: l.id,
        gender: l.gender,
        weightTier: l.weightTier,
        totalCount,
        availableCount,
        count: availableCount,
        poolCode: l.pool.code,
      };
    });

    return {
      id: b.id,
      code: b.code,
      groupName: b.group.name,
      totalQualified,
      availableCount: totalAvailable,
      lines,
    };
  });

  // 3. 查询全部分拣任务
  const tasks = await prisma.sortTask.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      machine: true,
      bundleBatch: {
        include: { group: true },
      },
    },
  });

  // 4. 查询分拣相关的品控记录 (分拣校准 SORT_CALIBRATE & 分拣巡检 SORT_INSPECT)
  const sortingQCs = await prisma.qCRecord.findMany({
    where: {
      cat: { in: ["SORT_CALIBRATE", "SORT_INSPECT"] },
    },
    orderBy: [{ checkTime: "desc" }, { uploadTime: "desc" }],
  });

  // 辅助获取机器的最新校准与巡检记录
  const getMachineQCs = (code: string) => {
    const calibrate = sortingQCs.find((q) => q.refId === code && q.cat === "SORT_CALIBRATE");
    const inspect = sortingQCs.find((q) => q.refId === code && q.cat === "SORT_INSPECT");
    return { calibrate, inspect };
  };

  const qualifiedMachines = machines.filter((m) => m.lastCalibrationStatus === "QUALIFIED").length;
  const exceptionMachines = machines.filter((m) => m.lastCalibrationStatus === "EXCEPTION").length;
  const pendingTasksCount = tasks.filter((t: any) => t.status === "PENDING").length;

  return (
    <div className="space-y-4">
      {/* 头部标题与操作栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            分拣称重管理
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            精准分规定重 · 计算分拣损耗率 · 合格品入库作为冷库可出库存源头 · 设备精度校验安全联锁
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <SortMachineDialog />
          <SortTaskDialog
            machines={machines}
            completedBundles={completedBundleOptions}
          />
        </div>
      </div>

      {/* 方案 A: Tab 标签分流工作台 */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b pb-2">
          <TabsList className="h-9 p-1">
            <TabsTrigger value="tasks" className="gap-1.5 text-xs">
              <Scale className="size-3.5" />
              分拣任务台账
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                {tasks.length}
              </Badge>
              {pendingTasksCount > 0 && (
                <span className="size-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20 animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="machines" className="gap-1.5 text-xs">
              <Cpu className="size-3.5" />
              设备监控与校准
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                {machines.length}
              </Badge>
              {exceptionMachines > 0 && (
                <span className="size-2 rounded-full bg-destructive ring-2 ring-destructive/20 animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="qc" className="gap-1.5 text-xs">
              <ClipboardCheck className="size-3.5" />
              精度与巡检留痕
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                {sortingQCs.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              设备: <b className="text-emerald-600 dark:text-emerald-400">{qualifiedMachines}</b>/{machines.length} 合格
            </span>
            {exceptionMachines > 0 && (
              <span className="text-destructive font-semibold">
                · {exceptionMachines} 台联锁锁定
              </span>
            )}
            {pendingTasksCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                · {pendingTasksCount} 笔待处理
              </span>
            )}
          </div>
        </div>

        {/* Tab 2: 分拣设备监控与校准卡控 */}
        <TabsContent value="machines" className="m-0 space-y-3">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">分拣设备监控与校准卡控</h2>
            <Badge variant="outline" className="text-[10px] font-mono">
              共 {machines.length} 台设备
            </Badge>
            <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-2 ml-1">
              <span className="text-emerald-600 font-medium">
                {qualifiedMachines} 台合格
              </span>
              {exceptionMachines > 0 && (
                <span className="text-destructive font-semibold">
                  · {exceptionMachines} 台异常联锁
                </span>
              )}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            * 仅当日校验合格设备允许开机，异常设备强制锁定
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {machines.map((m: any) => {
            const isException = m.lastCalibrationStatus === "EXCEPTION";
            const isDisabled = m.status === "DISABLED";
            const { calibrate, inspect } = getMachineQCs(m.code);

            let pendingTasks = 0, totalQualified = 0, totalLoss = 0;
            for (const t of m.tasks) {
              if (t.status === "PENDING") pendingTasks++;
              else if (t.status === "COMPLETED") {
                totalQualified += t.qualifiedCount;
                totalLoss += t.lossCount;
              }
            }

            const calibTime = m.lastCalibratedAt || calibrate?.checkTime;
            const calibTimeStr = calibTime ? formatTime(calibTime) : "06:35";

            return (
              <Card
                key={m.id}
                className={`p-3 transition-all border shadow-2xs flex flex-col justify-between gap-2.5 ${
                  isException
                    ? "border-destructive/60 bg-destructive/5"
                    : isDisabled
                    ? "opacity-60 border-border/60"
                    : "border-border/80 hover:border-primary/40"
                }`}
              >
                {/* 头部：设备名与操作 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-semibold text-foreground truncate" title={m.name}>
                        {m.name}
                      </h3>
                      {isDisabled && (
                        <Badge variant="secondary" className="text-[9px] h-3.5 px-1 shrink-0">
                          已停用
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground truncate">
                      {m.code}
                    </p>
                  </div>
                  <MachineCardActions machine={m} tasksCount={m.tasks.length} />
                </div>

                {/* 中间状态：异常联锁警告或校准与巡检信息 */}
                {isException ? (
                  <div className="p-1.5 rounded bg-destructive/15 border border-destructive/30 text-destructive text-[11px] font-semibold flex items-center gap-1.5 animate-pulse">
                    <ShieldAlert className="size-3.5 shrink-0" />
                    <span className="truncate">安全联锁已启动，禁止开机</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-mono flex items-center gap-1">
                      校准: {calibTimeStr}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      {calibrate && (
                        <QCViewDialog record={calibrate} triggerText="校验原件" />
                      )}
                      {inspect && (
                        <QCViewDialog record={inspect} triggerText="巡检留痕" />
                      )}
                    </div>
                  </div>
                )}

                {/* 底部四项指标 */}
                <div className="grid grid-cols-4 gap-1 text-center font-mono text-[11px] pt-1.5 border-t border-border/50">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">累计</span>
                    <span className="font-semibold text-foreground">{m.tasks.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">待分拣</span>
                    <span
                      className={`font-semibold ${
                        pendingTasks > 0 ? "text-amber-500" : "text-muted-foreground"
                      }`}
                    >
                      {pendingTasks}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">合格</span>
                    <span className="font-semibold text-primary">{totalQualified}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">损耗</span>
                    <span className="font-semibold text-muted-foreground">{totalLoss}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </TabsContent>

        {/* Tab 1: 分拣任务台账 */}
        <TabsContent value="tasks" className="m-0 space-y-4">
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="py-3 px-4 border-b bg-muted/30 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              分拣称重任务台账（共 {tasks.length} 笔）
            </CardTitle>
          </div>
          <span className="text-[11px] text-muted-foreground">
            分拣合格数实时计入冷库可出库库存
          </span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground border-b font-mono text-[11px]">
              <tr>
                <th className="px-3 py-2 font-medium whitespace-nowrap w-[140px]">任务号 (FJR)</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap w-[110px]">作业设备</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap w-[130px]">来源捆扎批次</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap w-[90px]">规格</th>
                <th className="px-3 py-2 font-medium text-right whitespace-nowrap w-[85px]">投入 (只)</th>
                <th className="px-3 py-2 font-medium text-right whitespace-nowrap w-[85px]">合格 (只)</th>
                <th className="px-3 py-2 font-medium text-right whitespace-nowrap w-[80px]">损耗 (只)</th>
                <th className="px-3 py-2 font-medium text-right whitespace-nowrap w-[80px]">损耗率</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap w-[90px]">状态</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap w-[95px]">作业时间</th>
                <th className="px-3 py-2 font-medium text-right whitespace-nowrap w-[115px]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-muted-foreground">
                    暂无分拣任务，请点击右上角「新建分拣任务 (FJR)」
                  </td>
                </tr>
              ) : (
                tasks.map((task: any) => {
                  const isCompleted = task.status === "COMPLETED";
                  const isHighLoss = isCompleted && task.lossRate > 5.0;

                  return (
                    <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 font-mono font-medium text-foreground whitespace-nowrap">
                        {task.code}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="font-mono text-foreground font-medium">{task.machine.code}</div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[120px]" title={task.machine.name}>
                          {task.machine.name}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground whitespace-nowrap">
                        <div>{task.bundleBatch.code}</div>
                        <span className="text-muted-foreground text-[11px] font-sans block">
                          {task.bundleBatch.group.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                            task.gender === "FEMALE"
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                              : "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                          }`}
                        >
                          {task.gender === "FEMALE" ? "母" : "公"} {task.weightTier}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-right text-foreground whitespace-nowrap">
                        {task.inputCount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-right text-foreground font-medium whitespace-nowrap">
                        {isCompleted ? task.qualifiedCount.toLocaleString() : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-right text-muted-foreground whitespace-nowrap">
                        {isCompleted ? task.lossCount.toLocaleString() : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-right whitespace-nowrap">
                        {isCompleted ? (
                          <span
                            className={
                              isHighLoss ? "text-destructive font-semibold bg-destructive/10 px-1 py-0.5 rounded" : "text-muted-foreground"
                            }
                          >
                            {task.lossRate}%{isHighLoss && " ⚠️"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            已完成
                          </span>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5 text-[10px]"
                          >
                            <Clock className="size-3 mr-1" /> 待分拣
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatShortDateTime(task.doneAt ?? task.date)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <SortTaskActions
                          taskId={task.id}
                          code={task.code}
                          status={task.status}
                          inputCount={task.inputCount}
                          spec={task.weightTier}
                          gender={task.gender}
                        />
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

    {/* Tab 3: 品控留痕记录区 (校准与巡检台账) */}
    <TabsContent value="qc" className="m-0 space-y-4">
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="py-2.5 px-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-primary shrink-0" />
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              分拣设备精度校验与车间巡检留痕
              <span className="text-xs font-normal text-muted-foreground font-mono">
                (共 {sortingQCs.length} 笔)
              </span>
            </CardTitle>
          </div>
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            <QCRecordDialog
              config={{ ...QC_PRESETS.calibrate, refId: machines[0]?.code || "FJ-01" }}
              triggerLabel="登记精度校验 (202607)"
            />
            <QCRecordDialog
              config={QC_PRESETS.inspect}
              triggerLabel="登记车间巡检 (202608)"
            />
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-mono">
              <tr>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[140px]">品控编号</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[180px]">类目 / 纸质表号</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[110px]">关联设备</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[150px]">现场校验时间</th>
                <th className="px-3 py-2.5 font-medium min-w-[200px]">校验/巡检结论</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[100px]">质检员</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap w-[110px]">状态</th>
                <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap w-[90px]">原件档案</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sortingQCs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-muted-foreground">
                    暂无分拣品控留痕记录
                  </td>
                </tr>
              ) : (
                sortingQCs.map((qc: any) => {
                  const isExp = qc.result === "EXCEPTION";
                  return (
                    <tr key={qc.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2.5 font-mono font-bold text-foreground whitespace-nowrap">
                        {qc.code}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-medium text-foreground block">{qc.title}</span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {qc.formNo || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-primary whitespace-nowrap">
                        {qc.refId}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                        {formatDateTime(qc.checkTime)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={isExp ? "text-destructive font-medium" : "text-foreground"}>
                          {qc.conclusion || "合格"}
                        </span>
                        {qc.reason && (
                          <span className="text-destructive text-[11px] block font-mono">
                            整改：{qc.reason}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{qc.uploader}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {isExp ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <AlertTriangle className="size-3 mr-1" /> 异常/需整改
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
                          >
                            <CheckCircle2 className="size-3 mr-1" /> 合格
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <QCViewDialog record={qc} triggerText="查验原件" />
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
