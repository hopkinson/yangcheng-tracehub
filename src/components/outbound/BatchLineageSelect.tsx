"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ThermometerSnowflake, ShieldCheck } from "lucide-react";
import { Invariants } from "@/lib/invariants";

export interface ColdBatchOption {
  id: string;
  code: string; // CR-XXXX
  storeName?: string; // 保鲜预冷A区
  storeCode?: string; // BX-01
  targetTemp?: number; // 4.2
  gender?: string;
  weightTier?: string;
  specLabel?: string;
  intakeCount?: number;
  availableCount?: number;
  refTaskCode?: string;
  farmerSummary?: string;
}

export interface SpecDemand {
  gender: string;
  weightTier: string;
  count: number;
}

export function resolveDemandBatchMap(
  demands: SpecDemand[],
  coldBatches: ColdBatchOption[] = [],
  selectedMap: Record<string, string> = {}
): Record<string, string> {
  const batchBySpec = new Map(
    coldBatches.map((b) => [`${b.gender}_${Invariants.normalizeWeightTier(b.weightTier)}`, b.id])
  );
  const map: Record<string, string> = { ...selectedMap };
  for (const d of demands) {
    const key = `${d.gender}_${Invariants.normalizeWeightTier(d.weightTier)}`;
    if (!map[key]) {
      map[key] = batchBySpec.get(key) || "";
    }
  }
  return map;
}

/**
 * 按规格智能对齐预冷批次调拨组件
 * 核心规则：先由发货订单确定规格需求，再针对每一项规格精确过滤并选择对应预冷批次
 */
export function SpecColdBatchAllocation({
  demands = [],
  coldBatches = [],
  selectedBatchMap = {},
  onSelectBatch,
}: {
  demands: SpecDemand[];
  coldBatches?: ColdBatchOption[];
  selectedBatchMap: Record<string, string>;
  onSelectBatch: (specKey: string, batchId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 border rounded-lg p-3 bg-muted/15">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
          <ThermometerSnowflake className="size-3.5 text-primary" />
          按规格关联保鲜库预冷批次（出库冷库调拨确认）
        </Label>
        <span className="text-[11px] text-muted-foreground font-mono">
          {demands.length > 0 ? `涉及 ${demands.length} 种规格` : "待勾选订单"}
        </span>
      </div>

      {demands.length === 0 ? (
        <div className="p-3 text-xs text-muted-foreground bg-background/80 rounded border border-dashed text-center">
          请先在上方勾选待发货订单，系统将自动汇总规格需求并精准配对冷库批次
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {demands.map((demand) => {
            const normDemandTier = Invariants.normalizeWeightTier(demand.weightTier);
            const specKey = `${demand.gender}_${normDemandTier}`;
            const specLabel = `${demand.gender === "FEMALE" ? "母蟹" : "公蟹"} ${normDemandTier}`;

            // 严格过滤：仅展示同性别、同重量档位的预冷批次（规格自动标准化）
            const matchedBatches = coldBatches.filter(
              (b) =>
                b.gender === demand.gender &&
                Invariants.normalizeWeightTier(b.weightTier) === normDemandTier
            );

            const activeBatchId =
              selectedBatchMap[specKey] ||
              matchedBatches.find((b) => (b.availableCount ?? 0) >= demand.count)?.id ||
              matchedBatches[0]?.id ||
              "";

            const currentBatch = matchedBatches.find((b) => b.id === activeBatchId) || matchedBatches[0];
            const isSufficient = (currentBatch?.availableCount ?? 0) >= demand.count;

            return (
              <div key={specKey} className="p-2.5 rounded-md bg-background border flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-semibold text-xs border-primary/30 text-primary">
                      {specLabel}
                    </Badge>
                    <span className="font-mono text-muted-foreground">
                      本次需求: <strong className="text-foreground">{demand.count}</strong> 只
                    </span>
                  </div>
                  {currentBatch && (
                    <span
                      className={`text-[11px] font-medium font-mono ${
                        isSufficient
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive font-semibold"
                      }`}
                    >
                      {isSufficient
                        ? `● 批次存量充足 (余 ${(currentBatch.availableCount ?? 0) - demand.count}只)`
                        : `▲ 批次存量不足 (缺 ${demand.count - (currentBatch.availableCount ?? 0)}只)`}
                    </span>
                  )}
                </div>

                {matchedBatches.length === 0 ? (
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400">
                    暂无该规格专属预冷批次，出库将按分拣合格品总可用量调拨扣减
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Select
                      value={activeBatchId}
                      onValueChange={(val) => onSelectBatch(specKey, val)}
                    >
                      <SelectTrigger className="h-8 text-xs font-mono bg-background">
                        <SelectValue placeholder="选择该规格调拨的预冷批次" />
                      </SelectTrigger>
                      <SelectContent>
                        {matchedBatches.map((b) => (
                          <SelectItem key={b.id} value={b.id} className="text-xs font-mono">
                            {b.code} · {b.storeName || "保鲜库"} {b.storeCode ? `(${b.storeCode})` : ""} · 规格: {b.specLabel} · 可用: {b.availableCount ?? 0}只
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {currentBatch && (
                      <div className="px-2 py-1 rounded bg-muted/30 border text-[11px] text-muted-foreground flex items-center justify-between font-mono">
                        <span className="flex items-center gap-1.5 truncate">
                          <ShieldCheck className="size-3 text-emerald-500 shrink-0" />
                          <span>
                            来源作业 {currentBatch.refTaskCode || "分拣任务"} · 养殖户: {currentBatch.farmerSummary || "签约基地"}
                          </span>
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          库位: {currentBatch.storeCode || currentBatch.storeName}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ColdBatchSelect({
  coldBatches = [],
  selectedBatchId,
  onSelectBatchId,
}: {
  coldBatches?: ColdBatchOption[];
  selectedBatchId: string;
  onSelectBatchId: (id: string) => void;
}) {
  const batches = coldBatches;
  const currentBatch = batches.find((b) => b.id === selectedBatchId) || batches[0];

  return (
    <div className="flex flex-col gap-2 border rounded-lg p-3 bg-muted/15">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
          <ThermometerSnowflake className="size-3.5 text-primary" />
          关联保鲜库预冷批次（出库冷库调拨确认）
        </Label>
        {batches.length > 0 && (
          <span className="text-[10px] text-muted-foreground font-mono">
            共 {batches.length} 个批次可选
          </span>
        )}
      </div>

      {batches.length === 0 ? (
        <div className="p-2 text-xs text-muted-foreground bg-background rounded border">
          暂无关联批次，系统将按规格实时可用库存进行调拨出库
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Select value={selectedBatchId} onValueChange={onSelectBatchId}>
            <SelectTrigger className="h-8 text-xs font-mono bg-background">
              <SelectValue placeholder="选择关联批次" />
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id} className="text-xs font-mono">
                  {b.code} · {b.storeName || "保鲜库"} {b.storeCode ? `(${b.storeCode})` : ""} · {b.specLabel || ""} · 存量 {b.availableCount ?? 0}只
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentBatch && (
            <div className="p-2.5 rounded-md bg-background border text-xs grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              <div>
                <span className="text-[10px] text-muted-foreground block">保鲜入库批次</span>
                <span className="font-bold text-foreground flex items-center gap-1">
                  {currentBatch.code}
                  <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono text-primary border-primary/30">
                    CR
                  </Badge>
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">存放保鲜库位</span>
                <span className="font-medium text-foreground truncate block" title={`${currentBatch.storeName} (${currentBatch.storeCode})`}>
                  {currentBatch.storeName} ({currentBatch.storeCode})
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">分拣合格规格</span>
                <span className="text-primary font-semibold truncate block" title={currentBatch.specLabel}>
                  {currentBatch.specLabel}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">在库可用余量</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {(currentBatch.availableCount ?? 0).toLocaleString()} 只
                </span>
              </div>
            </div>
          )}

          {currentBatch?.farmerSummary && (
            <div className="px-2 py-1 rounded bg-muted/30 border text-[11px] text-muted-foreground flex items-center gap-1.5 font-mono">
              <ShieldCheck className="size-3 text-emerald-500 shrink-0" />
              <span>全链路溯源穿透：来源作业 {currentBatch.refTaskCode || "分拣任务"} · 签约养殖户 {currentBatch.farmerSummary}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}