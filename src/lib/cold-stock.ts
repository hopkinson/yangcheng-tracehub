import { Invariants } from "@/lib/invariants";

export type ColdSpecStock = {
  gender: string;
  weightTier: string;
  label: string;
  qualified: number;
  used: number;
  loss: number;
  packagingLoss: number;
  clearanceLoss: number;
  available: number;
  usagePct: number;
};

export type ColdLocationStock = {
  storeId: string;
  storeName: string;
  storeCode: string;
  stocks: ColdSpecStock[];
  totalAvailable: number;
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
    bundleBatch: { sourceBatchId: string };
  }>;
  coldLogs: Array<{ id: string; count: number; type?: string; sortTaskId: string }>;
  outboundLines?: Array<{ count: number; coldLogId: string }>;
  outboundLosses?: Array<{ count: number; coldLogId: string; status?: string; lossType?: string }>;
  defaultSpecs?: Array<{ gender: string; weightTier: string }>;
}): ColdSpecStock[] {
  const taskMap = new Map(sortTasks.map((task) => [task.id, task] as const));
  const coldLogSpecs = new Map<string, { gender: string; weightTier: string }>();
  const stockMap = new Map<string, {
    qualified: number;
    used: number;
    loss: number;
    packagingLoss: number;
    clearanceLoss: number;
  }>();

  for (const log of coldLogs) {
    if (log.type && log.type !== "INTAKE") continue;
    const task = taskMap.get(log.sortTaskId);
    if (!task) continue;
    const spec = { gender: task.gender, weightTier: Invariants.normalizeWeightTier(task.weightTier) };
    const key = `${spec.gender}_${spec.weightTier}`;
    const current = stockMap.get(key) || { qualified: 0, used: 0, loss: 0, packagingLoss: 0, clearanceLoss: 0 };
    current.qualified += log.count || 0;
    stockMap.set(key, current);
    coldLogSpecs.set(log.id, spec);
  }

  const addUsage = (
    rows: Array<{ count: number; coldLogId: string; status?: string; lossType?: string }>,
    kind: "used" | "loss",
  ) => {
    for (const row of rows) {
      if (row.status === "REJECTED") continue;
      const spec = coldLogSpecs.get(row.coldLogId);
      if (!spec) continue;
      const key = `${spec.gender}_${spec.weightTier}`;
      const current = stockMap.get(key) || { qualified: 0, used: 0, loss: 0, packagingLoss: 0, clearanceLoss: 0 };
      current[kind] += row.count || 0;
      if (kind === "loss") {
        if (row.lossType === "PACKAGING") current.packagingLoss += row.count || 0;
        else current.clearanceLoss += row.count || 0;
      }
      stockMap.set(key, current);
    }
  };

  addUsage(outboundLines, "used");
  addUsage(outboundLosses, "loss");

  const finalKeys = new Set(stockMap.keys());
  for (const spec of defaultSpecs) {
    if (finalKeys.size >= 4) break;
    finalKeys.add(`${spec.gender}_${Invariants.normalizeWeightTier(spec.weightTier)}`);
  }

  return [...finalKeys]
    .map((key) => {
      const [gender, weightTier] = key.split("_");
      const {
        qualified = 0,
        used = 0,
        loss = 0,
        packagingLoss = 0,
        clearanceLoss = 0,
      } = stockMap.get(key) || {};
      const available = Math.max(0, qualified - used - loss);
      return {
        gender,
        weightTier,
        label: `${weightTier} ${gender === "FEMALE" ? "母蟹" : "公蟹"}`,
        qualified,
        used,
        loss,
        packagingLoss,
        clearanceLoss,
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

export function aggregateTraceableColdStocksByStore({
  sortTasks,
  coldLogs,
  outboundLines = [],
  outboundLosses = [],
}: {
  sortTasks: Parameters<typeof aggregateTraceableColdStocks>[0]["sortTasks"];
  coldLogs: Array<{
    id: string;
    count: number;
    type?: string;
    sortTaskId: string;
    store: { id: string; name: string; code: string };
  }>;
  outboundLines?: Array<{ count: number; coldLogId: string }>;
  outboundLosses?: Array<{ count: number; coldLogId: string; status?: string; lossType?: string }>;
}): ColdLocationStock[] {
  const stores = new Map<string, { id: string; name: string; code: string }>();
  for (const log of coldLogs) stores.set(log.store.id, log.store);

  return [...stores.values()].map((store) => {
    const storeLogs = coldLogs.filter((log) => log.store.id === store.id);
    const logIds = new Set(storeLogs.map((log) => log.id));
    const stocks = aggregateTraceableColdStocks({
      sortTasks,
      coldLogs: storeLogs,
      outboundLines: outboundLines.filter((line) => logIds.has(line.coldLogId)),
      outboundLosses: outboundLosses.filter((loss) => logIds.has(loss.coldLogId)),
      defaultSpecs: [],
    }).filter((stock) => stock.qualified > 0);

    return {
      storeId: store.id,
      storeName: store.name,
      storeCode: store.code,
      stocks,
      totalAvailable: stocks.reduce((sum, stock) => sum + stock.available, 0),
    };
  }).filter((location) => location.stocks.length > 0);
}
