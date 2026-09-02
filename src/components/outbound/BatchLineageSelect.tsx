"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers } from "lucide-react";

export interface RawBatchOption {
  id: string;
  code: string;
  farmerName: string;
  farmerCode: string;
  poolCode: string;
  specSummary: string;
  liveCount: number;
}

export function BatchLineageSelect({
  rawBatches,
  selectedBatchId,
  onSelectBatchId,
}: {
  rawBatches: RawBatchOption[];
  selectedBatchId: string;
  onSelectBatchId: (id: string) => void;
}) {
  const currentBatch = rawBatches.find((b) => b.id === selectedBatchId) || rawBatches[0];

  return (
    <div className="space-y-2 border rounded-lg p-3 bg-muted/15">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Layers className="size-3.5 text-primary" />
          关联原料入库批次（来源追溯核对确认）
        </Label>
        {rawBatches.length > 0 && (
          <span className="text-[10px] text-muted-foreground font-mono">
            共 {rawBatches.length} 个在养批次可选
          </span>
        )}
      </div>

      {rawBatches.length === 0 ? (
        <div className="p-2 text-xs text-muted-foreground bg-background rounded border">
          系统将自动关联最近一次原料批次进行履约追溯
        </div>
      ) : (
        <div className="space-y-2">
          <Select value={selectedBatchId} onValueChange={onSelectBatchId}>
            <SelectTrigger className="h-8 text-xs font-mono bg-background">
              <SelectValue placeholder="选择关联原料批次" />
            </SelectTrigger>
            <SelectContent>
              {rawBatches.map((b) => (
                <SelectItem key={b.id} value={b.id} className="text-xs font-mono">
                  {b.code} · {b.farmerName} ({b.farmerCode}) · {b.poolCode} · 存活 {b.liveCount}只
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentBatch && (
            <div className="p-2.5 rounded-md bg-background border text-xs grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              <div>
                <span className="text-[10px] text-muted-foreground block">原料批次号</span>
                <span className="font-bold text-foreground">{currentBatch.code}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">来源养殖户</span>
                <span className="font-medium text-foreground">{currentBatch.farmerName} ({currentBatch.farmerCode})</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">暂养池与规格</span>
                <span className="text-primary truncate" title={currentBatch.specSummary}>
                  {currentBatch.poolCode} ({currentBatch.specSummary})
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">批次在池存活</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{currentBatch.liveCount.toLocaleString()} 只</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}