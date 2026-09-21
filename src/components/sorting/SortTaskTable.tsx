"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, Clock, Layers } from "lucide-react";
import { BatchCompleteSortDialog } from "./BatchCompleteSortDialog";
import { SortTaskActions } from "./SortTaskActions";
import { formatShortDateTime } from "@/lib/utils";

export interface SortTaskItem {
  id: string;
  code: string;
  date: string | Date;
  doneAt?: string | Date | null;
  machineId: string;
  machine: {
    id: string;
    code: string;
    name: string;
  };
  bundleBatchId: string;
  bundleBatch: {
    id: string;
    code: string;
    group: {
      name: string;
    };
    sourceBatch?: {
      code: string;
    } | null;
  };
  gender: string;
  weightTier: string;
  inputCount: number;
  qualifiedCount: number;
  lossCount: number;
  lossRate: number;
  status: string;
  createdAt?: string | Date;
}

interface BatchGroup {
  batchKey: string;
  baseCode: string;
  machine: SortTaskItem["machine"];
  bundleBatch: SortTaskItem["bundleBatch"];
  sourceBatchCode: string;
  tasks: SortTaskItem[];
  totalInput: number;
  totalQualified: number;
  totalLoss: number;
  overallLossRate: number;
  isAllCompleted: boolean;
  isPartialCompleted: boolean;
  pendingTasks: SortTaskItem[];
  completedTasks: SortTaskItem[];
  latestDate: string | Date;
  latestDoneAt?: string | Date | null;
}

export function SortTaskTable({ tasks }: { tasks: SortTaskItem[] }) {
  // 维护展开的批次 Key 集合
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // 聚合批次数据
  const batchGroups = useMemo(() => {
    const map = new Map<string, BatchGroup>();

    for (const task of tasks) {
      const baseCode = task.code.replace(/-\d+$/, "");
      const batchKey = `${task.bundleBatchId}_${baseCode}`;

      let group = map.get(batchKey);
      if (!group) {
        group = {
          batchKey,
          baseCode,
          machine: task.machine,
          bundleBatch: task.bundleBatch,
          sourceBatchCode: task.bundleBatch.sourceBatch?.code || "—",
          tasks: [],
          totalInput: 0,
          totalQualified: 0,
          totalLoss: 0,
          overallLossRate: 0,
          isAllCompleted: false,
          isPartialCompleted: false,
          pendingTasks: [],
          completedTasks: [],
          latestDate: task.date,
          latestDoneAt: task.doneAt,
        };
        map.set(batchKey, group);
      }

      group.tasks.push(task);
      group.totalInput += task.inputCount;

      if (task.status === "COMPLETED") {
        group.completedTasks.push(task);
        group.totalQualified += task.qualifiedCount;
        group.totalLoss += task.lossCount;
      } else {
        group.pendingTasks.push(task);
      }
    }

    // 排序子任务与计算综合指标
    const list = Array.from(map.values()).map((group) => {
      group.tasks.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      group.isAllCompleted = group.tasks.length > 0 && group.pendingTasks.length === 0;
      group.isPartialCompleted = group.completedTasks.length > 0 && group.pendingTasks.length > 0;

      const completedInput = group.completedTasks.reduce((sum, t) => sum + t.inputCount, 0);
      group.overallLossRate =
        completedInput > 0 ? Number(((group.totalLoss / completedInput) * 100).toFixed(2)) : 0;

      return group;
    });

    return list;
  }, [tasks]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandedKeys.size === batchGroups.length) {
      setExpandedKeys(new Set());
    } else {
      setExpandedKeys(new Set(batchGroups.map((g) => g.batchKey)));
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-xs">
        暂无分拣任务，请点击右上角「新建分拣任务 (FJR)」
      </div>
    );
  }

  const allExpanded = batchGroups.length > 0 && expandedKeys.size === batchGroups.length;

  return (
    <div className="space-y-2">
      {/* 快捷视图切换与操作栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border rounded-lg text-xs">
        <div className="flex items-center gap-2 text-muted-foreground font-mono">
          <span>共聚合 <strong className="text-foreground">{batchGroups.length}</strong> 个分拣批次</span>
          <span>·</span>
          <span>包含 <strong className="text-foreground">{tasks.length}</strong> 笔规格工单</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleExpandAll}
          className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
        >
          <Layers className="size-3" />
          {allExpanded ? "全部收起明细" : "全部展开明细"}
        </Button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full min-w-[1180px] text-xs text-left">
          <thead className="bg-muted/40 text-muted-foreground border-b font-mono text-[11px]">
            <tr>
              <th className="px-3 py-2 font-medium whitespace-nowrap w-[170px]">任务批次 (FJR)</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap min-w-[110px]">作业设备</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap w-[120px]">原料批次</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap w-[130px]">来源捆扎批次</th>
              <th className="px-3 py-2 font-medium min-w-[200px]">包含规格明细</th>
              <th className="px-3 py-2 font-medium text-right whitespace-nowrap w-[85px]">投入 (只)</th>
              <th className="px-3 py-2 font-medium text-right whitespace-nowrap w-[85px]">合格 (只)</th>
              <th className="px-3 py-2 font-medium text-right whitespace-nowrap w-[80px]">损耗 (只)</th>
              <th className="px-3 py-2 font-medium text-right whitespace-nowrap w-[80px]">损耗率</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap w-[100px]">状态</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap w-[95px]">作业时间</th>
              <th className="px-3 py-2 font-medium text-right whitespace-nowrap w-[130px]">操作</th>
            </tr>
          </thead>
          {batchGroups.map((group) => {
            const isExpanded = expandedKeys.has(group.batchKey);
            const isHighLoss = group.completedTasks.length > 0 && group.overallLossRate > 5.0;
            const hasMultipleTasks = group.tasks.length > 1;

            return (
              <tbody key={group.batchKey} className="divide-y divide-border/40 border-b border-border/60">
                  {/* 主行 (批次聚合行) */}
                  <tr
                    className={`transition-colors cursor-pointer ${
                      isExpanded ? "bg-muted/30" : "hover:bg-muted/20"
                    }`}
                    onClick={() => hasMultipleTasks && toggleExpand(group.batchKey)}
                  >
                    {/* 任务批次号 + 展开按钮 */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {hasMultipleTasks ? (
                          <button
                            type="button"
                            className="size-4 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(group.batchKey);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-3.5 text-foreground" />
                            ) : (
                              <ChevronRight className="size-3.5 text-muted-foreground" />
                            )}
                          </button>
                        ) : (
                          <span className="size-4 inline-block" />
                        )}
                        <div>
                          <div className="font-mono font-bold text-foreground flex items-center gap-1.5">
                            <span>{group.baseCode}</span>
                            {hasMultipleTasks && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1 font-mono font-normal">
                                {group.tasks.length} 规格
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 设备 */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-mono text-foreground font-medium">{group.machine.code}</div>
                      <div className="text-[10px] text-muted-foreground" title={group.machine.name}>
                        {group.machine.name}
                      </div>
                    </td>

                    {/* 原料批次 */}
                    <td className="px-3 py-2.5 font-mono text-foreground whitespace-nowrap font-medium">
                      {group.sourceBatchCode}
                    </td>

                    {/* 来源捆扎批次 */}
                    <td className="px-3 py-2.5 font-mono text-foreground whitespace-nowrap">
                      <div>{group.bundleBatch.code}</div>
                      <span className="text-muted-foreground text-[10px] font-sans block">
                        {group.bundleBatch.group.name}
                      </span>
                    </td>

                    {/* 规格明细标签 */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {group.tasks.map((task) => {
                          const isFemale = task.gender === "FEMALE";
                          const isTaskDone = task.status === "COMPLETED";
                          return (
                            <span
                              key={task.id}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                                isTaskDone
                                  ? "bg-muted/40 text-muted-foreground border-border/60 line-through"
                                  : isFemale
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                                  : "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                              }`}
                            >
                              <span>{isFemale ? "母" : "公"}{task.weightTier}</span>
                              <span className="font-bold">{task.inputCount}只</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* 投入总数 */}
                    <td className="px-3 py-2.5 font-mono tabular-nums text-right text-foreground font-bold whitespace-nowrap">
                      {group.totalInput.toLocaleString()}
                    </td>

                    {/* 合格总数 */}
                    <td className="px-3 py-2.5 font-mono tabular-nums text-right text-foreground font-bold whitespace-nowrap">
                      {group.completedTasks.length > 0 ? (
                        group.totalQualified.toLocaleString()
                      ) : (
                        <span className="text-muted-foreground/40 font-normal">—</span>
                      )}
                    </td>

                    {/* 损耗总数 */}
                    <td className="px-3 py-2.5 font-mono tabular-nums text-right text-muted-foreground whitespace-nowrap font-medium">
                      {group.completedTasks.length > 0 ? (
                        group.totalLoss.toLocaleString()
                      ) : (
                        <span className="text-muted-foreground/40 font-normal">—</span>
                      )}
                    </td>

                    {/* 综合损耗率 */}
                    <td className="px-3 py-2.5 font-mono tabular-nums text-right whitespace-nowrap">
                      {group.completedTasks.length > 0 ? (
                        <span
                          className={
                            isHighLoss
                              ? "text-destructive font-semibold bg-destructive/10 px-1 py-0.5 rounded text-[11px]"
                              : "text-muted-foreground"
                          }
                        >
                          {group.overallLossRate}%{isHighLoss && " ⚠️"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 font-normal">—</span>
                      )}
                    </td>

                    {/* 状态 */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {group.isAllCompleted ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          已完成
                        </span>
                      ) : group.isPartialCompleted ? (
                        <Badge
                          variant="outline"
                          className="text-sky-600 dark:text-sky-400 border-sky-500/30 bg-sky-500/5 text-[10px]"
                        >
                          分拣中 ({group.completedTasks.length}/{group.tasks.length})
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5 text-[10px]"
                        >
                          <Clock className="size-3 mr-1" /> 待分拣
                        </Badge>
                      )}
                    </td>

                    {/* 作业时间 */}
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatShortDateTime(group.latestDoneAt ?? group.latestDate)}
                    </td>

                    {/* 主行操作 */}
                    <td
                      className="px-3 py-2.5 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {group.pendingTasks.length > 0 ? (
                        hasMultipleTasks ? (
                          <BatchCompleteSortDialog
                            batchCode={group.baseCode}
                            machineName={group.machine.name}
                            sourceBatchCode={group.sourceBatchCode}
                            tasks={group.pendingTasks.map((t) => ({
                              id: t.id,
                              code: t.code,
                              gender: t.gender,
                              weightTier: t.weightTier,
                              inputCount: t.inputCount,
                            }))}
                          />
                        ) : (
                          <SortTaskActions
                            taskId={group.tasks[0].id}
                            code={group.tasks[0].code}
                            status={group.tasks[0].status}
                            inputCount={group.tasks[0].inputCount}
                            spec={group.tasks[0].weightTier}
                            gender={group.tasks[0].gender}
                          />
                        )
                      ) : (
                        <div className="flex items-center justify-end text-[11px] text-muted-foreground font-mono">
                          全部合格入库
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* 子行明细 (展开时呈现) */}
                  {isExpanded &&
                    group.tasks.map((task) => {
                      const isTaskCompleted = task.status === "COMPLETED";
                      const isFemale = task.gender === "FEMALE";
                      const isTaskHighLoss = isTaskCompleted && task.lossRate > 5.0;

                      return (
                        <tr
                          key={task.id}
                          className="bg-muted/10 hover:bg-muted/20 border-l-2 border-l-primary/60 transition-colors"
                        >
                          {/* 子任务工单号 */}
                          <td className="px-3 py-1.5 pl-8 font-mono text-xs text-muted-foreground whitespace-nowrap">
                            <span className="text-foreground font-medium">{task.code}</span>
                          </td>

                          {/* 作业设备 */}
                          <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {task.machine.code}
                          </td>

                          {/* 原料批次 */}
                          <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {task.bundleBatch.sourceBatch?.code || "—"}
                          </td>

                          {/* 来源捆扎批次 */}
                          <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {task.bundleBatch.code}
                          </td>

                          {/* 规格 */}
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                                isFemale
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                  : "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                              }`}
                            >
                              {isFemale ? "母" : "公"} {task.weightTier}
                            </span>
                          </td>

                          {/* 投入 */}
                          <td className="px-3 py-1.5 font-mono tabular-nums text-right text-foreground whitespace-nowrap">
                            {task.inputCount.toLocaleString()}
                          </td>

                          {/* 合格 */}
                          <td className="px-3 py-1.5 font-mono tabular-nums text-right text-foreground whitespace-nowrap">
                            {isTaskCompleted ? (
                              task.qualifiedCount.toLocaleString()
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>

                          {/* 损耗 */}
                          <td className="px-3 py-1.5 font-mono tabular-nums text-right text-muted-foreground whitespace-nowrap">
                            {isTaskCompleted ? (
                              task.lossCount.toLocaleString()
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>

                          {/* 损耗率 */}
                          <td className="px-3 py-1.5 font-mono tabular-nums text-right whitespace-nowrap">
                            {isTaskCompleted ? (
                              <span
                                className={
                                  isTaskHighLoss
                                    ? "text-destructive font-semibold bg-destructive/10 px-1 py-0.5 rounded text-[10px]"
                                    : "text-muted-foreground text-[11px]"
                                }
                              >
                                {task.lossRate}%{isTaskHighLoss && " ⚠️"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>

                          {/* 状态 */}
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {isTaskCompleted ? (
                              <span className="inline-flex items-center gap-1.5 text-muted-foreground text-[11px]">
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                已完成
                              </span>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5 text-[9px] h-4 px-1"
                              >
                                待分拣
                              </Badge>
                            )}
                          </td>

                          {/* 时间 */}
                          <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatShortDateTime(task.doneAt ?? task.date)}
                          </td>

                          {/* 单项操作 */}
                          <td className="px-3 py-1.5 text-right whitespace-nowrap">
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
                    })}
                </tbody>
              );
            })}
        </table>
      </div>
    </div>
  );
}
