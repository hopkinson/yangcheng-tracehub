import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortTaskDialog } from "@/components/sorting/SortTaskDialog";
import { CompleteSortDialog } from "@/components/sorting/CompleteSortDialog";
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
import { format } from "date-fns";

export const dynamic = "force-dynamic";

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

  // 2. 查询已完成捆扎批次 (status=COMPLETED)
  const completedBundles = await prisma.bundleBatch.findMany({
    where: { status: "COMPLETED" },
    orderBy: { date: "desc" },
    include: {
      group: true,
      lines: { include: { pool: true } },
    },
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

  return (
    <div className="space-y-6">
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
          <QCRecordDialog
            config={{
              cat: "SORT_CALIBRATE",
              categoryLabel: "分拣校准",
              defaultTitle: "分拣设备精度校验记录表",
              formNoPreset: "YCGF-PZZX-202607",
              refType: "MACHINE",
              refId: machines[0]?.code || "FJ-01",
              conclusions: [
                "50g/150g/200g 标准砝码校验误差均 <= +-1.5g，准予开机",
                "校验误差超限 (>+-3.0g)，需停机校正重新标定",
              ],
            }}
            triggerLabel="登记精度校验 (202607)"
          />
          <SortTaskDialog
            machines={machines.map((m: any) => ({
              id: m.id,
              code: m.code,
              name: m.name,
              status: m.status,
              lastCalibrationStatus: m.lastCalibrationStatus,
            }))}
            completedBundles={completedBundles.map((b: any) => ({
              id: b.id,
              code: b.code,
              groupName: b.group.name,
              lines: b.lines.map((l: any) => ({
                id: l.id,
                gender: l.gender,
                weightTier: l.weightTier,
                count: l.count,
                poolCode: l.pool.code,
              })),
            }))}
          />
        </div>
      </div>

      {/* 12.2 分拣设备与校准卡控卡片 */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">分拣设备监控与校准卡控</h2>
            <Badge variant="outline" className="text-[10px] font-mono">
              共 {machines.length} 台设备
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground">
            * 仅当日校验合格设备允许开机作业，异常设备触发安全联锁强制锁定
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {machines.map((m: any) => {
            const isException = m.lastCalibrationStatus === "EXCEPTION";
            const isPending = m.lastCalibrationStatus === "PENDING";
            const isDisabled = m.status === "DISABLED";
            const { calibrate, inspect } = getMachineQCs(m.code);

            const totalQualified = m.tasks.reduce(
              (a: number, t: any) => a + (t.status === "COMPLETED" ? t.qualifiedCount : 0),
              0
            );
            const totalLoss = m.tasks.reduce(
              (a: number, t: any) => a + (t.status === "COMPLETED" ? t.lossCount : 0),
              0
            );
            const pendingTasks = m.tasks.filter((t: any) => t.status === "PENDING").length;

            // 格式化校准时间
            const calibTimeStr = m.lastCalibratedAt
              ? format(new Date(m.lastCalibratedAt), "HH:mm")
              : calibrate?.checkTime
              ? format(new Date(calibrate.checkTime), "HH:mm")
              : "06:35";

            return (
              <Card
                key={m.id}
                className={`border shadow-xs transition-all ${
                  isException
                    ? "border-destructive/50 bg-destructive/5"
                    : isDisabled
                    ? "opacity-60 border-border/60"
                    : "border-border/80"
                }`}
              >
                <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="size-4 text-primary" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-semibold">{m.name}</CardTitle>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          ({m.code})
                        </span>
                        {isDisabled && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            已停用
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <MachineCardActions machine={m} tasksCount={m.tasks.length} />
                </CardHeader>

                <CardContent className="p-3.5 space-y-3">
                  {/* 异常警示条 */}
                  {isException && (
                    <div className="p-2 rounded bg-destructive/15 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                      <ShieldAlert className="size-4 shrink-0" />
                      <span>校验未通过，设备安全联锁启动，禁止开机作业！</span>
                    </div>
                  )}

                  {/* 校准与巡检品控状态 */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-muted/30 border text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-[11px]">当日校准：</span>
                      {m.lastCalibrationStatus === "QUALIFIED" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium font-mono text-[11px]">
                          <CheckCircle2 className="size-3.5" />
                          已合格 ({calibTimeStr})
                        </span>
                      ) : isException ? (
                        <span className="inline-flex items-center gap-1 text-destructive font-bold font-mono text-[11px]">
                          <AlertTriangle className="size-3.5" />
                          校验异常
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium font-mono text-[11px]">
                          <Clock className="size-3.5" />
                          待校验
                        </span>
                      )}
                    </div>

                    {calibrate && (
                      <QCViewDialog
                        record={calibrate}
                        triggerText="查看精度校验原件 (202607)"
                      />
                    )}
                  </div>

                  {/* 巡检记录关联 */}
                  {inspect && (
                    <div className="text-[11px] flex items-center justify-between text-muted-foreground px-1">
                      <span className="truncate">
                        巡检留痕：
                        <span className="text-foreground font-medium">{inspect.conclusion}</span>
                      </span>
                      <QCViewDialog record={inspect} triggerText="巡检原件" />
                    </div>
                  )}

                  {/* 运行与任务统计 */}
                  <div className="grid grid-cols-4 gap-2 text-xs font-mono pt-1 border-t">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">累计任务</span>
                      <span className="text-sm font-bold text-foreground">{m.tasks.length} 笔</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">待分拣</span>
                      <span
                        className={`text-sm font-bold ${
                          pendingTasks > 0 ? "text-amber-500 font-semibold" : "text-muted-foreground"
                        }`}
                      >
                        {pendingTasks} 笔
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">合格入库</span>
                      <span className="text-sm font-bold text-primary">{totalQualified} 只</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">分拣损耗</span>
                      <span className="text-sm font-bold text-muted-foreground">{totalLoss} 只</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 12.3 分拣任务台账 */}
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
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-mono">
              <tr>
                <th className="px-3 py-2.5 font-medium">任务号 (FJR)</th>
                <th className="px-3 py-2.5 font-medium">作业设备</th>
                <th className="px-3 py-2.5 font-medium">来源捆扎批次</th>
                <th className="px-3 py-2.5 font-medium">分规规格</th>
                <th className="px-3 py-2.5 font-medium">投入只数</th>
                <th className="px-3 py-2.5 font-medium">合格只数</th>
                <th className="px-3 py-2.5 font-medium">损耗只数</th>
                <th className="px-3 py-2.5 font-medium">损耗率 (%)</th>
                <th className="px-3 py-2.5 font-medium">状态</th>
                <th className="px-3 py-2.5 font-medium">作业时间</th>
                <th className="px-3 py-2.5 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-muted-foreground">
                    暂无分拣任务，请点击右上角「新建分拣任务 (FJR)」
                  </td>
                </tr>
              ) : (
                tasks.map((task: any) => {
                  const isHighLoss = task.lossRate > 5.0;
                  const timeDisplay = task.doneAt
                    ? format(new Date(task.doneAt), "MM-dd HH:mm")
                    : format(new Date(task.date), "MM-dd HH:mm");

                  return (
                    <tr key={task.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2.5 font-mono font-bold text-foreground">
                        {task.code}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {task.machine.code} ({task.machine.name})
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-primary font-medium">
                        {task.bundleBatch.code}
                        <span className="text-muted-foreground text-[11px] block">
                          {task.bundleBatch.group.name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium">
                        <span className={task.gender === "FEMALE" ? "text-rose-600 font-semibold" : "text-sky-600 font-semibold"}>
                          {task.gender === "FEMALE" ? "母蟹" : "公蟹"}
                        </span>{" "}
                        <span className="font-mono">{task.weightTier}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-foreground">
                        {task.inputCount} 只
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-emerald-600">
                        {task.status === "COMPLETED" ? `${task.qualifiedCount} 只` : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">
                        {task.status === "COMPLETED" ? `${task.lossCount} 只` : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {task.status === "COMPLETED" ? (
                          <span
                            className={`font-bold ${
                              isHighLoss ? "text-destructive" : "text-foreground"
                            }`}
                          >
                            {task.lossRate}% {isHighLoss && "⚠️"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {task.status === "COMPLETED" ? (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
                          >
                            <CheckCircle2 className="size-3 mr-1" /> 已完成
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-amber-500 border-amber-500/30 text-[10px] animate-pulse"
                          >
                            <Clock className="size-3 mr-1" /> 待分拣
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                        {timeDisplay}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {task.status === "PENDING" && (
                          <CompleteSortDialog
                            taskId={task.id}
                            code={task.code}
                            inputCount={task.inputCount}
                            spec={task.weightTier}
                            gender={task.gender}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 12.4 品控留痕记录区 (校准与巡检台账) */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="py-3 px-4 border-b bg-muted/30 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              分拣设备精度校验与车间巡检留痕（共 {sortingQCs.length} 笔）
            </CardTitle>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            YCGF-PZZX-202607 / YCGF-PZZX-202608
          </span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-mono">
              <tr>
                <th className="px-3 py-2.5 font-medium">品控编号</th>
                <th className="px-3 py-2.5 font-medium">类目 / 纸质表号</th>
                <th className="px-3 py-2.5 font-medium">关联设备</th>
                <th className="px-3 py-2.5 font-medium">现场校验时间</th>
                <th className="px-3 py-2.5 font-medium">校验/巡检结论</th>
                <th className="px-3 py-2.5 font-medium">质检员</th>
                <th className="px-3 py-2.5 font-medium">状态</th>
                <th className="px-3 py-2.5 font-medium text-right">原件档案</th>
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
                      <td className="px-3 py-2.5 font-mono font-bold text-foreground">
                        {qc.code}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-foreground block">{qc.title}</span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {qc.formNo || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-primary">
                        {qc.refId}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">
                        {format(new Date(qc.checkTime), "yyyy-MM-dd HH:mm")}
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
                      <td className="px-3 py-2.5 text-muted-foreground">{qc.uploader}</td>
                      <td className="px-3 py-2.5">
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
                      <td className="px-3 py-2.5 text-right">
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
    </div>
  );
}
