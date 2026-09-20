import { Invariants } from "@/lib/invariants";
import { aggregateTraceableColdStocks } from "@/lib/cold-stock";

export interface PipelineSpecStock {
  gender: string;
  weightTier: string;
  holding: number;   // 暂养在池（待起池）
  bundling: number;  // 捆扎在制（加工中/待分拣）
  sorting: number;   // 分拣合格（待入冷库）
  cold: number;      // 保鲜在库（即时可发出库）
  total: number;     // 全链可用总供给
}

export function aggregatePipelineStocks({
  batches = [],
  batchItems = [],
  bundleBatches = [],
  sortTasks = [],
  coldLogs = [],
  outboundLines = [],
  outboundLosses = [],
}: {
  batches?: any[];
  batchItems?: any[];
  bundleBatches?: any[];
  sortTasks?: any[];
  coldLogs?: any[];
  outboundLines?: any[];
  outboundLosses?: any[];
}): Record<string, PipelineSpecStock> {
  const stockMap: Record<string, PipelineSpecStock> = {};

  const getEntry = (gender: string, rawTier: string) => {
    const tier = Invariants.normalizeWeightTier(rawTier);
    const key = `${gender}_${tier}`;
    if (!stockMap[key]) {
      stockMap[key] = {
        gender,
        weightTier: tier,
        holding: 0,
        bundling: 0,
        sorting: 0,
        cold: 0,
        total: 0,
      };
    }
    return stockMap[key];
  };

  // 1. 暂养池在池存活 (兼顾 BatchItem 与单规格 Batch)
  const batchIdHasItems = new Set(batchItems.map((i) => i.batchId));
  const activeSources = [
    ...batchItems.filter((i) => i.batch?.status !== "FROZEN"),
    ...batches.filter((b) => b.status !== "FROZEN" && !batchIdHasItems.has(b.id)),
  ];
  for (const s of activeSources) {
    const live = Math.max(0, (s.inPoolCount || 0) - (s.outPoolCount || 0) - (s.lossCount || 0));
    getEntry(s.gender, s.weightTier).holding += live;
  }

  // 2. 捆扎在制与待分拣（已起池但尚未被分拣机完全承接）
  const sortInputByBundle = new Map<string, number>();
  for (const st of sortTasks) {
    if (st.bundleBatchId) {
      sortInputByBundle.set(st.bundleBatchId, (sortInputByBundle.get(st.bundleBatchId) || 0) + (st.inputCount || 0));
    }
  }

  for (const bb of bundleBatches) {
    const lines = bb.lines || [];
    const totalLineCount = lines.reduce((s: number, l: any) => s + (l.count || 0), 0);
    const consumedCount = sortInputByBundle.get(bb.id) || 0;
    const remainingRatio = totalLineCount > 0 ? Math.max(0, (totalLineCount - consumedCount) / totalLineCount) : 0;

    for (const l of lines) {
      const activeCount = Math.round((l.count || 0) * remainingRatio);
      if (activeCount > 0) {
        getEntry(l.gender, l.weightTier).bundling += activeCount;
      }
    }
  }

  // 3. 分拣合格待入库（分拣已出合格品，但尚未录入保鲜库）
  const coldIntakeByTask = new Map<string, number>();
  for (const cl of coldLogs) {
    if (cl.type === "INTAKE" && cl.sortTaskId) {
      coldIntakeByTask.set(cl.sortTaskId, (coldIntakeByTask.get(cl.sortTaskId) || 0) + (cl.count || 0));
    }
  }

  for (const st of sortTasks) {
    const qualified = st.qualifiedCount || 0;
    const intaken = coldIntakeByTask.get(st.id) || 0;
    const pendingCold = Math.max(0, qualified - intaken);
    if (pendingCold > 0) {
      getEntry(st.gender, st.weightTier).sorting += pendingCold;
    }
  }

  // 4. 保鲜在库（复用成熟的 aggregateTraceableColdStocks 计算可发出库量）
  const coldStocks = aggregateTraceableColdStocks({
    sortTasks,
    coldLogs,
    outboundLines,
    outboundLosses,
    defaultSpecs: [],
  });

  for (const cs of coldStocks) {
    getEntry(cs.gender, cs.weightTier).cold += cs.available;
  }

  // 5. 汇总全链总存量
  for (const stock of Object.values(stockMap)) {
    stock.total = stock.holding + stock.bundling + stock.sorting + stock.cold;
  }

  return stockMap;
}
