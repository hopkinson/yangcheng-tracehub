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

export interface PoolOption {
  id: string;
  code: string;
  name: string;
  currentGender: string | null;
  currentWeightTier: string | null;
  liveCount: number;
}

export interface TagClaimOption {
  id: string;
  code: string | null;
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
  tagClaims,
  pools,
}: {
  groups: GroupOption[];
  tagClaims: TagClaimOption[];
  pools: PoolOption[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id || "");
  const [selectedTagId, setSelectedTagId] = useState(tagClaims[0]?.id || "");
  const [ropeBatch, setRopeBatch] = useState("XS2026090101");

  // 多选池子
  const [selectedPools, setSelectedPools] = useState<
    Array<{ poolId: string; gender: string; weightTier: string; count: number }>
  >([]);

  const currentTag = tagClaims.find((t) => t.id === selectedTagId);
  const availableTags = currentTag?.availableCount ?? currentTag?.claimCount ?? 0;
  const totalCrabs = selectedPools.reduce((acc, cur) => acc + (cur.count || 0), 0);
  const isTagExceeded = totalCrabs > availableTags;

  const handleAddPool = (poolId: string) => {
    const p = pools.find((x) => x.id === poolId);
    if (!p) return;
    if (p.liveCount <= 0) {
      toast.error(`暂养池 ${p.code} (${p.name}) 为空池，无活蟹可出池捆扎`);
      return;
    }
    if (selectedPools.some((x) => x.poolId === poolId)) {
      toast.error("该暂养池已在来源列表中");
      return;
    }
    setSelectedPools([
      ...selectedPools,
      {
        poolId,
        gender: p.currentGender || "MALE",
        weightTier: p.currentWeightTier || "4.0两",
        count: Math.min(500, p.liveCount),
      },
    ]);
  };

  const handleRemovePool = (poolId: string) => {
    setSelectedPools(selectedPools.filter((x) => x.poolId !== poolId));
  };

  const handleCountChange = (poolId: string, count: number) => {
    const p = pools.find((x) => x.id === poolId);
    const max = p?.liveCount ?? 1;
    const clamped = Math.max(1, Math.min(max, count));
    setSelectedPools(
      selectedPools.map((x) => (x.poolId === poolId ? { ...x, count: clamped } : x))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !selectedTagId || !ropeBatch.trim()) {
      toast.error("请填写完整班组、蟹扣与蟹绳批次");
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
    if (selectedPools.some((i) => {
      const p = pools.find((x) => x.id === i.poolId);
      return !p || p.liveCount <= 0 || i.count > p.liveCount;
    })) {
      toast.error("所选来源池存活不足或为空池，禁止出池建批");
      return;
    }

    startTransition(async () => {
      const res = await createBundleBatchAction({
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
    <Dialog open={open} onOpenChange={setOpen}>
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
            一个捆扎批次绑定一种已审核蟹扣、手填蟹绳批次，并可合并多个同规格暂养池来源。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto px-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 捆扎组选择 */}
            <div className="space-y-1.5">
              <Label className="text-xs">作业捆扎班组</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="选择班组" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id} className="text-xs">
                      {g.name} ({g.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 蟹扣批次 (单选已通过 XK) */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Tag className="size-3.5 text-primary" />
                专属蟹扣批次（仅已过审）
              </Label>
              <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                <SelectTrigger className="h-9 text-xs font-mono">
                  <SelectValue placeholder="选择蟹扣批次" />
                </SelectTrigger>
                <SelectContent>
                  {tagClaims.length === 0 ? (
                    <SelectItem value="none" disabled className="text-xs">
                      暂无审核通过的蟹扣，请先前往领扣审批
                    </SelectItem>
                  ) : (
                    tagClaims.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs font-mono">
                        {t.code || "—"} · {t.farmerName} (可用: {t.availableCount ?? t.claimCount} / 领: {t.claimCount})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 蟹绳批次 (手填) */}
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

          {/* 来源暂养池多选 */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Waves className="size-4 text-primary" />
                来源暂养池与出池数量
              </Label>
              <Select onValueChange={handleAddPool}>
                <SelectTrigger className="h-7 w-48 text-xs">
                  <SelectValue placeholder="+ 添加来源暂养池" />
                </SelectTrigger>
                <SelectContent>
                  {pools.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={p.liveCount <= 0} className="text-xs font-mono">
                      {p.code} {p.name} ({p.currentGender === "FEMALE" ? "母" : "公"}{p.currentWeightTier || "未定"} · {p.liveCount > 0 ? `存${p.liveCount}只` : "空池"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPools.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded">
                请点击右上角选择需要合并捆扎的暂养池来源（已过滤空池）
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                {selectedPools.map((item) => {
                  const p = pools.find((x) => x.id === item.poolId);
                  const maxLive = p?.liveCount ?? 0;
                  const isPoolExceeded = item.count > maxLive || maxLive <= 0;
                  return (
                    <div
                      key={item.poolId}
                      className="flex items-center justify-between gap-3 p-2 bg-background border rounded text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-foreground mr-2">{p?.code}</span>
                        <span className="text-muted-foreground mr-2">{p?.name}</span>
                        <span className="text-primary font-medium">
                          {item.gender === "FEMALE" ? "母蟹" : "公蟹"} {item.weightTier}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-2 font-mono">
                          (在池存活: {maxLive} 只)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-[11px] text-muted-foreground">出池只数:</Label>
                        <Input
                          type="number"
                          min={1}
                          max={maxLive > 0 ? maxLive : 1}
                          value={item.count}
                          onChange={(e) => handleCountChange(item.poolId, parseInt(e.target.value, 10) || 0)}
                          className={`h-7 w-24 text-xs font-mono text-right ${isPoolExceeded ? "border-destructive text-destructive" : ""}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePool(item.poolId)}
                          className="h-7 px-2 text-destructive text-xs"
                        >
                          移除
                        </Button>
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-end items-center gap-2 pt-2 text-xs font-mono font-bold text-foreground">
                  <span>本次捆扎合计只数：</span>
                  <span className={`text-base ${isTagExceeded ? "text-destructive" : "text-primary"}`}>
                    {totalCrabs} 只
                  </span>
                  {currentTag && (
                    <span className="text-[11px] font-normal text-muted-foreground ml-1">
                      (所选蟹扣批次可用: {availableTags} 只)
                    </span>
                  )}
                </div>
                {isTagExceeded && (
                  <p className="text-[11px] text-destructive text-right font-medium">
                    ⚠ 蟹的只数 ({totalCrabs}) 不能超过蟹扣可用数 ({availableTags})，禁止建批
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || selectedPools.length === 0 || isTagExceeded || totalCrabs <= 0}
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
