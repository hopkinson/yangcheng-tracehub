import { Invariants } from "@/lib/invariants";

export type ColdSpecStock = {
  gender: string;
  weightTier: string;
  label: string;
  qualified: number;
  used: number;
  loss: number;
  available: number;
  usagePct: number;
};

const DEFAULT_SPECS = [
  { gender: "MALE", weightTier: "4.0两" },
  { gender: "MALE", weightTier: "3.5两" },
  { gender: "FEMALE", weightTier: "3.5两" },
  { gender: "FEMALE", weightTier: "3.0两" },
];

export function aggregateTraceableColdStocks({
  sortTasks,
  coldLogs,
  outboundLines = [],
  outboundLosses = [],
  defaultSpecs = DEFAULT_SPECS,
}: {
  sortTasks: Array<{
    id: string;
    code: string;
    gender: string;
    weightTier: string;
    bundleBatch?: { sourceBatchId?: string | null } | null;
  }>;
  coldLogs: Array<{ id: string; count: number; type?: string; sortTaskId?: string | null; refId?: string | null }>;
  outboundLines?: Array<{ count: number; coldLogId?: string | null; gender?: string; weightTier?: string }>;
  outboundLosses?: Array<{ count: number; coldLogId?: string | null }>;
  defaultSpecs?: Array<{ gender: string; weightTier: string }>;
}): ColdSpecStock[] {
  const traceableTasks = sortTasks.filter((task) => Boolean(task.bundleBatch?.sourceBatchId));
  const taskMap = new Map(traceableTasks.map((task) => [task.id, task] as const));
  const taskByRef = new Map<string, (typeof traceableTasks)[number]>();
  for (const task of traceableTasks) {
    taskByRef.set(task.id, task);
    taskByRef.set(task.code, task);
  }
  const coldLogSpecs = new Map<string, { gender: string; weightTier: string }>();
  const stockMap = new Map<string, { qualified: number; used: number; loss: number }>();

  for (const log of coldLogs) {
    if (log.type && log.type !== "INTAKE") continue;
    const task = log.sortTaskId
      ? taskMap.get(log.sortTaskId)
      : log.refId
        ? taskByRef.get(log.refId)
        : undefined;
    if (!task) continue;
    const spec = { gender: task.gender, weightTier: Invariants.normalizeWeightTier(task.weightTier) };
    const key = `${spec.gender}_${spec.weightTier}`;
    const current = stockMap.get(key) || { qualified: 0, used: 0, loss: 0 };
    current.qualified += log.count || 0;
    stockMap.set(key, current);
    coldLogSpecs.set(log.id, spec);
  }

  const addUsage = (rows: Array<{ count: number; coldLogId?: string | null }>, kind: "used" | "loss") => {
    for (const row of rows) {
      if (!row.coldLogId) continue;
      const spec = coldLogSpecs.get(row.coldLogId);
      if (!spec) continue;
      const key = `${spec.gender}_${spec.weightTier}`;
      const current = stockMap.get(key) || { qualified: 0, used: 0, loss: 0 };
      current[kind] += row.count || 0;
      stockMap.set(key, current);
    }
  };

  addUsage(outboundLines, "used");
  addUsage(outboundLosses, "loss");

  // 历史出库明细可能没有 coldLogId，但仍能按规格从总库存中扣除。
  for (const row of outboundLines) {
    if (row.coldLogId || !row.gender || !row.weightTier) continue;
    const key = `${row.gender}_${Invariants.normalizeWeightTier(row.weightTier)}`;
    const current = stockMap.get(key) || { qualified: 0, used: 0, loss: 0 };
    current.used += row.count || 0;
    stockMap.set(key, current);
  }

  const finalKeys = new Set(stockMap.keys());
  for (const spec of defaultSpecs) {
    if (finalKeys.size >= 4) break;
    finalKeys.add(`${spec.gender}_${Invariants.normalizeWeightTier(spec.weightTier)}`);
  }

  return [...finalKeys]
    .map((key) => {
      const [gender, weightTier] = key.split("_");
      const { qualified = 0, used = 0, loss = 0 } = stockMap.get(key) || {};
      const available = Math.max(0, qualified - used - loss);
      return {
        gender,
        weightTier,
        label: `${weightTier} ${gender === "FEMALE" ? "母蟹" : "公蟹"}`,
        qualified,
        used,
        loss,
        available,
        usagePct: qualified > 0 ? Math.min(100, Math.round(((used + loss) / qualified) * 100)) : 0,
      };
    })
    .sort((a, b) =>
      a.gender !== b.gender
        ? a.gender === "MALE"
          ? -1
          : 1
        : parseFloat(b.weightTier) - parseFloat(a.weightTier)
    );
}
