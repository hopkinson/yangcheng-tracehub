"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ThermometerSnowflake, ShieldCheck } from "lucide-react";

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
    <div className="space-y-2 border rounded-lg p-3 bg-muted/15">
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
        <div className="space-y-2">
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