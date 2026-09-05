"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { registerPoolLossAction } from "@/actions/pools";
import { toast } from "sonner";
import { AlertTriangle, ClipboardList, Waves, Lock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PoolLossDialogProps {
  pool: {
    id: string;
    code: string;
    name: string;
    currentGender: string | null;
    currentWeightTier: string | null;
    batchItems?: any[];
  };
  totalLive: number;
  userId: string;
  disabled?: boolean;
  trigger?: React.ReactNode;
  className?: string;
}

const PRESET_REASONS = ["常规暂养自然损耗", "运输应激脱水", "蜕壳残损"];

export function PoolLossDialog({
  pool,
  totalLive,
  userId,
  disabled = false,
  trigger,
  className,
}: PoolLossDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // 筛选出在池存活 > 0 的批次明细
  const activeItems = (pool.batchItems || []).filter(
    (it) => it.inPoolCount - (it.outPoolCount || 0) - (it.lossCount || 0) > 0
  );

  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [lossCountInput, setLossCountInput] = useState<string>("0");
  const [physicalCountInput, setPhysicalCountInput] = useState<string>("0");
  const [reason, setReason] = useState<string>("");

  const currentItem =
    activeItems.find((it) => it.id === selectedItemId) || activeItems[0];

  const itemLive = currentItem
    ? currentItem.inPoolCount - (currentItem.outPoolCount || 0) - (currentItem.lossCount || 0)
    : totalLive;

  function syncCounts(loss: number, physical: number) {
    setLossCountInput(String(Math.max(0, loss)));
    setPhysicalCountInput(String(Math.max(0, physical)));
  }

  // 重置表单
  useEffect(() => {
    if (open) {
      setSelectedItemId(activeItems[0]?.id || "");
      const live = activeItems[0]
        ? activeItems[0].inPoolCount - (activeItems[0].outPoolCount || 0) - (activeItems[0].lossCount || 0)
        : totalLive;
      syncCounts(0, live);
      setReason("");
    }
  }, [open, totalLive, activeItems.length]);

  function handleSelectBatch(itemId: string) {
    setSelectedItemId(itemId);
    const it = activeItems.find((x) => x.id === itemId);
    const live = it ? it.inPoolCount - (it.outPoolCount || 0) - (it.lossCount || 0) : itemLive;
    syncCounts(0, live);
  }

  function handleLossChange(val: string) {
    const l = Math.max(0, parseInt(val, 10) || 0);
    syncCounts(l, itemLive - l);
  }

  function handlePhysicalChange(val: string) {
    const p = Math.max(0, parseInt(val, 10) || 0);
    syncCounts(itemLive - p, p);
  }

  const numLoss = parseInt(lossCountInput, 10) || 0;
  const numPhysical = parseInt(physicalCountInput, 10) || 0;

  // 批次累计损耗预测与率
  const batchTotalIn = currentItem?.batch?.inPoolCount || itemLive;
  const batchHistLoss = currentItem?.batch?.lossCount || 0;
  const projectedCumulativeLoss = batchHistLoss + numLoss;
  const projectedLossRate =
    batchTotalIn > 0 ? ((projectedCumulativeLoss / batchTotalIn) * 100).toFixed(2) : "0.00";
  const isHighLoss = Number(projectedLossRate) > 5.0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (numLoss <= 0) {
      toast.error("登记损耗只数必须大于 0");
      return;
    }

    if (numLoss > itemLive) {
      toast.error(`损耗只数 (${numLoss} 只) 不能大于当前在池存活数 (${itemLive} 只)`);
      return;
    }

    if (isHighLoss && !reason.trim()) {
      toast.error("累计损耗率超 5%，请务必详细填写损耗原因说明");
      return;
    }

    setLoading(true);
    try {
      await registerPoolLossAction({
        poolId: pool.id,
        batchItemId: currentItem?.id,
        batchId: currentItem?.batch?.id,
        lossCount: numLoss,
        reason: reason.trim() || "暂养期死蟹/损耗盘点",
        inspectorId: userId,
      });

      toast.success(`暂养池【${pool.name}】损耗登记成功，在池扣减 ${numLoss} 只！`);
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "损耗登记失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const isPoolEmpty = totalLive <= 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || isPoolEmpty}
            className={cn(
              "h-7 px-1.5 text-[11px] flex items-center justify-center gap-1 text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/30 disabled:opacity-50",
              className
            )}
            title={isPoolEmpty ? "当前池为空池，无在养存活大闸蟹" : "登记暂养期损耗与死亡死蟹"}
          >
            <ClipboardList className="size-3 text-rose-500 shrink-0" />
            <span className="truncate">盘点损耗</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600">
              <ClipboardList className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                暂养损耗与死蟹盘点登记
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                记录暂养池内大闸蟹因暂养、蜕壳或环境因素产生的死蟹损耗，保持数量闭环准确。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-1 text-xs">
          {/* 1. 暂养池与在养信息头 */}
          <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Waves className="size-3.5 text-primary" />
                <span>{pool.name}</span>
                <span className="font-mono text-muted-foreground">({pool.code})</span>
              </div>
              <Badge variant="outline" className="text-[11px] border-primary/30 bg-primary/5 text-primary">
                <Lock className="size-3 mr-1" />
                {pool.currentGender === "MALE" ? "公蟹" : pool.currentGender === "FEMALE" ? "母蟹" : "未锁定"} ·{" "}
                {pool.currentWeightTier || "任意规格"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">整池在池存活:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {totalLive.toLocaleString()} 只
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">在养批次数:</span>
                <span className="font-mono font-medium">{activeItems.length} 批次</span>
              </div>
            </div>
          </div>

          {/* 2. 合池批次归属选择 (若有多批次) */}
          {activeItems.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <span>选择损耗归属批次</span>
                <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto rounded-md border p-1.5">
                {activeItems.map((item) => {
                  const live = item.inPoolCount - (item.outPoolCount || 0) - (item.lossCount || 0);
                  const isSelected = item.id === (currentItem?.id || "");
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectBatch(item.id)}
                      className={`flex items-center justify-between rounded px-2.5 py-1.5 text-xs text-left transition-colors ${
                        isSelected
                          ? "border border-primary bg-primary/10 text-foreground font-medium"
                          : "border border-border/60 hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium">{item.batch?.code}</span>
                        <span>· {item.batch?.farmer?.name || "未知农户"}</span>
                      </div>
                      <div className="font-mono text-[11px]">
                        当前在池: <strong className="text-foreground">{live}</strong> 只
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeItems.length === 1 && currentItem && (
            <div className="flex items-center justify-between rounded border px-2.5 py-1.5 bg-muted/20 text-xs">
              <span className="text-muted-foreground">归属批次:</span>
              <span className="font-mono font-medium text-foreground">
                {currentItem.batch?.code} ({currentItem.batch?.farmer?.name || "养殖户"}) · 在池 {itemLive} 只
              </span>
            </div>
          )}

          {/* 3. 双向联动录入区 */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <span>本次死亡 / 捞出死蟹</span>
                <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max={itemLive}
                  value={lossCountInput}
                  onChange={(e) => handleLossChange(e.target.value)}
                  className="font-mono text-base font-bold text-rose-600 dark:text-rose-400 pr-8"
                  placeholder="0"
                  autoFocus
                />
                <span className="absolute right-2.5 top-2 text-xs text-muted-foreground">只</span>
              </div>
              <span className="text-[10px] text-muted-foreground">直接输入本次捞除的死蟹只数</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <span>现场实盘存活数</span>
                <span className="text-muted-foreground font-normal">(联动)</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max={itemLive}
                  value={physicalCountInput}
                  onChange={(e) => handlePhysicalChange(e.target.value)}
                  className="font-mono text-base font-bold pr-8"
                  placeholder={String(itemLive)}
                />
                <span className="absolute right-2.5 top-2 text-xs text-muted-foreground">只</span>
              </div>
              <span className="text-[10px] text-muted-foreground">或输入清点后的活蟹剩余只数</span>
            </div>
          </div>

          {/* 4. 损耗指标核算栏 */}
          <div className="rounded-md border p-2.5 text-xs flex flex-col gap-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">盘点前在池存活:</span>
              <span>{itemLive.toLocaleString()} 只</span>
            </div>
            <div className="flex justify-between text-rose-600 dark:text-rose-400 font-semibold">
              <span>本次损耗核减:</span>
              <span>-{numLoss.toLocaleString()} 只</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold text-foreground">
              <span>登记后在池存活:</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {Math.max(0, itemLive - numLoss).toLocaleString()} 只
              </span>
            </div>
            <div className="flex justify-between pt-0.5 text-[11px]">
              <span className="text-muted-foreground">批次累计损耗率:</span>
              <span className={isHighLoss ? "text-destructive font-bold" : "text-muted-foreground"}>
                {projectedLossRate}% {isHighLoss && "(超 5% 红线阈值)"}
              </span>
            </div>
          </div>

          {/* 5. 5% 红线警示 */}
          {isHighLoss && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div>
                <strong>【损耗超标预警】：</strong>
                累计损耗率已达到 {projectedLossRate}%（超过 5% 警戒红线）。请详细查明并在下方说明损耗原因，品控主管将介入核验。
              </div>
            </div>
          )}

          {/* 6. 快捷原因与输入 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                损耗原因说明 {isHighLoss && <span className="text-destructive">*</span>}
              </label>
              <span className="text-[10px] text-muted-foreground">点击快捷填入</span>
            </div>

            <div className="flex flex-wrap gap-1">
              {PRESET_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className="rounded border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>

            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入本次死蟹损耗的具体产生原因（如暂养脱水、换壳自相残杀、水体溶氧波动等）..."
              className="text-xs min-h-[64px]"
            />
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || numLoss <= 0 || numLoss > itemLive}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {loading && <Loader2 className="size-3.5 animate-spin mr-1" />}
              确认登记损耗 ({numLoss} 只)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
