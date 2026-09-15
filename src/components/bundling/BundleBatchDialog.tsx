"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Plus, Loader2, Tag, Waves } from "lucide-react";
import { createBundleBatchAction } from "@/actions/production";

export interface MaterialBatchOption {
  id: string;
  code: string;
  farmerId: string;
  farmerName: string;
  inPoolTime: string;
  liveCount: number;
}

export interface PoolOption {
  id: string;
  batchId: string;
  code: string;
  name: string;
  currentGender: string | null;
  currentWeightTier: string | null;
  liveCount: number;
  farmerName?: string | null;
}

export interface TagClaimOption {
  id: string;
  code: string | null;
  farmerId: string;
  farmerName: string;
  claimCount: number;
  availableCount?: number;
}

export interface GroupOption {
  id: string;
  code: string;
  name: string;
}

export function BundleBatchDialog({
  groups,
  materialBatches,
  tagClaims,
  pools,
}: {
  groups: GroupOption[];
  materialBatches: MaterialBatchOption[];
  tagClaims: TagClaimOption[];
  pools: PoolOption[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firstBatch = materialBatches[0];
  const firstTagForBatch = (batch?: MaterialBatchOption) =>
    tagClaims.find((tag) => tag.farmerId === batch?.farmerId && (tag.availableCount ?? tag.claimCount) > 0);

  const [selectedBatchId, setSelectedBatchId] = useState(firstBatch?.id || "");
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id || "");
  const [selectedTagId, setSelectedTagId] = useState(firstTagForBatch(firstBatch)?.id || "");
  const [ropeBatch, setRopeBatch] = useState("");
  const [selectedPools, setSelectedPools] = useState<
    Array<{ poolId: string; gender: string; weightTier: string; count: number }>
  >([]);

  const currentBatch = materialBatches.find((batch) => batch.id === selectedBatchId);
  const availableTagClaims = currentBatch
    ? tagClaims.filter(
        (tag) => tag.farmerId === currentBatch.farmerId && (tag.availableCount ?? tag.claimCount) > 0
      )
    : [];
  const visiblePools = pools.filter((pool) => pool.batchId === selectedBatchId);
  const currentTag = availableTagClaims.find((tag) => tag.id === selectedTagId);
  const availableTags = currentTag?.availableCount ?? 0;
  const totalCrabs = selectedPools.reduce((acc, cur) => acc + (cur.count || 0), 0);
  const isTagExceeded = totalCrabs > availableTags;

  const handleBatchChange = (batchId: string) => {
    const batch = materialBatches.find((item) => item.id === batchId);
    setSelectedBatchId(batchId);
    setSelectedPools([]);
    setSelectedTagId(firstTagForBatch(batch)?.id || "");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const nextBatch = materialBatches[0];
      setSelectedBatchId(nextBatch?.id || "");
      setSelectedTagId(firstTagForBatch(nextBatch)?.id || "");
      setSelectedPools([]);
      setRopeBatch("");
    }
    setOpen(nextOpen);
  };

  const handleTogglePool = (pool: PoolOption) => {
    if (pool.liveCount <= 0) return;
    const isSelected = selectedPools.some((item) => item.poolId === pool.id);
    if (isSelected) {
      setSelectedPools(selectedPools.filter((item) => item.poolId !== pool.id));
      return;
    }
    setSelectedPools([
      ...selectedPools,
      {
        poolId: pool.id,
        gender: pool.currentGender || "MALE",
        weightTier: pool.currentWeightTier || "4.0两",
        count: pool.liveCount,
      },
    ]);
  };

  const handleCountChange = (poolId: string, count: number) => {
    const pool = visiblePools.find((item) => item.id === poolId);
    const max = pool?.liveCount ?? 1;
    const clamped = Math.max(0, Math.min(max, count));
    setSelectedPools(
      selectedPools.map((item) => (item.poolId === poolId ? { ...item, count: clamped } : item))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || !selectedGroupId || !selectedTagId || !ropeBatch.trim()) {
      toast.error("请填写完整原料批次、班组、蟹扣与蟹绳批次");
      return;
    }
    if (selectedPools.length === 0) {
      toast.error("请至少选择一个来源暂养池");
      return;
    }
    if (isTagExceeded) {
      toast.error(`本次捆扎只数 (${totalCrabs} 只) 超出蟹扣批次可用余量 (${availableTags} 只)`);
      return;
    }
    if (selectedPools.some((item) => {
      const pool = visiblePools.find((option) => option.id === item.poolId);
      return !pool || pool.liveCount <= 0 || item.count <= 0 || item.count > pool.liveCount;
    })) {
      toast.error("出池只数必须大于 0，且不能超过本批次库存");
      return;
    }

    startTransition(async () => {
      const res = await createBundleBatchAction({
        batchId: selectedBatchId,
        groupId: selectedGroupId,
        tagClaimId: selectedTagId,
        ropeBatch,
        lines: selectedPools,
      });

      if (res.success) {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-9 gap-1.5 bg-primary text-primary-foreground font-medium shadow-xs">
          <Plus className="size-4" />
          新建捆扎批次 (KZD)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Layers className="size-5 text-primary" />
            新建大闸蟹捆扎批次
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            按原料入池顺序处理；一个捆扎批次只绑定一个原料批次，可合并该批次的多个暂养池来源。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              原料批次（先入先处理）
            </Label>
            <Select value={selectedBatchId} onValueChange={handleBatchChange} disabled={materialBatches.length === 0}>
              <SelectTrigger className="h-9 text-xs font-mono">
                <SelectValue placeholder="暂无待捆扎原料批次" />
              </SelectTrigger>
              <SelectContent>
                {materialBatches.length === 0 ? (
                  <SelectItem value="none" disabled className="text-xs">
                    暂无待捆扎原料批次
                  </SelectItem>
                ) : (
                  materialBatches.map((batch, index) => (
                    <SelectItem key={batch.id} value={batch.id} disabled={index > 0} className="text-xs font-mono">
                      {batch.code} · {batch.farmerName} · 剩余 {batch.liveCount} 只 · {batch.inPoolTime}
                      {index === 0 ? " · 当前应处理" : " · 等待前序批次"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {materialBatches.length > 1 && (
              <p className="text-[11px] text-muted-foreground">
                后续批次已按入池时间排队，当前批次处理完成后自动开放下一批。
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">作业捆扎班组</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="选择班组" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id} className="text-xs">
                      {group.name} ({group.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Tag className="size-3.5 text-primary" />
                专属蟹扣批次（仅当前原料养殖户）
              </Label>
              <Select value={selectedTagId} onValueChange={setSelectedTagId} disabled={availableTagClaims.length === 0}>
                <SelectTrigger className="h-9 text-xs font-mono">
                  <SelectValue placeholder="选择蟹扣批次" />
                </SelectTrigger>
                <SelectContent>
                  {availableTagClaims.length === 0 ? (
                    <SelectItem value="none" disabled className="text-xs">
                      当前原料批次暂无可用已审核蟹扣
                    </SelectItem>
                  ) : (
                    availableTagClaims.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id} className="text-xs font-mono">
                        {tag.code || "—"} · {tag.farmerName} (可用: {tag.availableCount ?? tag.claimCount} / 领: {tag.claimCount})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              蟹绳批次号 <span className="text-[11px] text-muted-foreground">（年度大批次，手工填报）</span>
            </Label>
            <Input
              value={ropeBatch}
              onChange={(e) => setRopeBatch(e.target.value)}
              placeholder="例如：XS2026090101"
              className="h-9 text-xs font-mono"
            />
          </div>

          <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Waves className="size-4 text-primary" />
                当前原料批次的暂养池与出池数量
              </Label>
              <span className={`text-[11px] font-mono ${selectedPools.length > 0 ? "text-primary font-medium" : "text-muted-foreground"}`}>
                {selectedPools.length > 0 ? `已选 ${selectedPools.length} 个暂养池来源` : "仅显示当前原料批次库存"}
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {visiblePools.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded">
                  当前原料批次暂无可出池库存
                </div>
              ) : (
                visiblePools.map((pool) => {
                  const isEmpty = pool.liveCount <= 0;
                  const poolGender = pool.currentGender || "MALE";
                  const poolWeightTier = pool.currentWeightTier || "4.0两";
                  const selectedItem = selectedPools.find((item) => item.poolId === pool.id);
                  const isChecked = !!selectedItem;

                  return (
                    <div
                      key={pool.id}
                      className={`flex items-center gap-3 p-2 rounded border text-xs transition-colors ${
                        isEmpty
                          ? "opacity-50 bg-muted/30"
                          : isChecked
                          ? "bg-primary/10 border-primary/40 font-medium"
                          : "bg-background hover:bg-muted/40"
                      }`}
                    >
                      <label
                        className={`grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 select-none ${
                          isEmpty ? "cursor-not-allowed" : "cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isEmpty}
                          onChange={() => handleTogglePool(pool)}
                          className="size-3.5 accent-primary cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="min-w-0 truncate font-semibold text-foreground" title={pool.name}>
                          {pool.name}
                        </span>
                        <span className={`whitespace-nowrap text-xs ${isChecked ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                          {poolGender === "FEMALE" ? "母蟹" : "公蟹"} · {poolWeightTier}
                        </span>
                        <span className="whitespace-nowrap text-[10px] text-muted-foreground font-mono">
                          可用 {pool.liveCount}只
                        </span>
                      </label>

                      {isChecked && selectedItem && (
                        <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                          <Label className="text-[11px] text-muted-foreground">出池</Label>
                          <Input
                            type="number"
                            min={1}
                            max={pool.liveCount}
                            value={selectedItem.count || ""}
                            onChange={(e) => handleCountChange(pool.id, parseInt(e.target.value, 10) || 0)}
                            onBlur={() => handleCountChange(pool.id, selectedItem.count || 1)}
                            className="h-7 w-20 text-xs font-mono text-right"
                          />
                          <span className="text-[11px] text-muted-foreground font-mono">只</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end items-center gap-2 overflow-x-auto whitespace-nowrap border-t pt-2 text-xs font-mono text-foreground">
              <span className="font-semibold">本次捆扎</span>
              <span className={`text-base font-bold ${isTagExceeded ? "text-destructive" : "text-primary"}`}>
                {totalCrabs} 只
              </span>
              {currentTag && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-[11px] text-muted-foreground">蟹扣可用 {availableTags} 只</span>
                </>
              )}
              {isTagExceeded && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-[11px] font-medium text-destructive">蟹扣不足，禁止建批</span>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!selectedBatchId || !selectedTagId || isPending || selectedPools.length === 0 || isTagExceeded || totalCrabs <= 0}
              className="gap-1.5 bg-primary text-primary-foreground font-medium"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              确认建批并开始捆扎 ({totalCrabs} 只)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
