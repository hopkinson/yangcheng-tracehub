"use client";

import { useEffect, useState } from "react";
import { batchRegisterOutboundLossAction } from "@/actions/outbound";
import { Invariants } from "@/lib/invariants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  Sparkles,
  RotateCcw,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

type SpecStock = {
  gender: string;
  weightTier: string;
  label: string;
  qualified: number;
  used: number;
  loss: number;
  available: number;
};

const PRESET_REASONS = ["当日收尾清库盘点结算", "发货前死蟹", "装箱挑损", "残损不可发"];

export function OutboundLossDialog({ specStocks }: { specStocks: SpecStock[] }) {
  const availableStocks = specStocks.filter((s) => s.available > 0);
  const [open, setOpen] = useState(false);
  const [physicalInputs, setPhysicalInputs] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const getStockKey = (s: { gender: string; weightTier: string }) => `${s.gender}_${s.weightTier}`;

  const resetToBook = () => {
    setPhysicalInputs(Object.fromEntries(availableStocks.map((s) => [getStockKey(s), String(s.available)])));
  };

  useEffect(() => {
    if (!open) return;
    resetToBook();
    setReason("");
  }, [open, specStocks]);

  const clampCount = (val: number, max: number) => Math.max(0, Math.min(max, val));

  const getRowLoss = (stock: SpecStock) => {
    const raw = physicalInputs[getStockKey(stock)];
    if (raw === undefined || raw === "") return 0;
    return stock.available - clampCount(Math.floor(Number(raw) || 0), stock.available);
  };

  const getLossInputValue = (stock: SpecStock) => {
    return physicalInputs[getStockKey(stock)] === "" ? "" : String(getRowLoss(stock));
  };

  const handleLossChange = (stock: SpecStock, val: string) => {
    const key = getStockKey(stock);
    if (val === "") {
      setPhysicalInputs((prev) => ({ ...prev, [key]: "" }));
      return;
    }
    const loss = clampCount(Math.floor(Number(val) || 0), stock.available);
    setPhysicalInputs((prev) => ({ ...prev, [key]: String(stock.available - loss) }));
  };

  const handlePhysicalChange = (stock: SpecStock, val: string) => {
    const key = getStockKey(stock);
    if (val === "") {
      setPhysicalInputs((prev) => ({ ...prev, [key]: "" }));
      return;
    }
    const physical = clampCount(Math.floor(Number(val) || 0), stock.available);
    setPhysicalInputs((prev) => ({ ...prev, [key]: val }));
  };

  // 单行一键归零（清库）
  const handleRowZero = (stock: SpecStock) => {
    const key = getStockKey(stock);
    setPhysicalInputs((prev) => ({ ...prev, [key]: "0" }));
    if (!reason.trim()) setReason("当日收尾清库盘点结算");
  };

  // 全规格一键全部归零（收尾全清）
  const handleClearAll = () => {
    setPhysicalInputs(Object.fromEntries(availableStocks.map((s) => [getStockKey(s), "0"])));
    setReason("当日收尾清库盘点结算");
    toast.info(`已一键将全部 ${availableStocks.length} 个规格实盘归零`);
  };

  // 全规格一键全部无损（恢复账面）
  const handleResetAll = () => {
    resetToBook();
    toast.info("已重置为账面可发库存（损耗全归零）");
  };

  // 全局汇总统计
  const totalAvailable = availableStocks.reduce((sum, s) => sum + s.available, 0);
  const totalLoss = availableStocks.reduce((sum, s) => sum + getRowLoss(s), 0);
  const totalPhysical = totalAvailable - totalLoss;
  const totalQualified = availableStocks.reduce((sum, s) => sum + s.qualified, 0);
  const totalHistoricalLoss = availableStocks.reduce((sum, s) => sum + s.loss, 0);

  const specLossDetails = availableStocks.map((stock) => {
    const rowLoss = getRowLoss(stock);
    const rowPhysical = stock.available - rowLoss;
    const lossResult = Invariants.calculateLoss({
      bookInPool: stock.available,
      physicalCount: rowPhysical,
      inPoolCount: stock.qualified,
      historicalLoss: stock.loss,
    });
    return { stock, rowLoss, rowPhysical, lossResult };
  });

  const overallLossResult = Invariants.calculateLoss({
    bookInPool: totalAvailable,
    physicalCount: totalPhysical,
    inPoolCount: totalQualified,
    historicalLoss: totalHistoricalLoss,
  });

  const isHighLoss =
    specLossDetails.some((d) => d.lossResult.isException) || Boolean(overallLossResult.isException);

  async function handleSubmit() {
    if (totalLoss <= 0) {
      toast.error("请至少登记一只损耗或清库数量");
      return;
    }
    if (isHighLoss && !reason.trim()) {
      toast.error("累计出库损耗率超过 5%，请务必详细填写损耗原因说明");
      return;
    }

    const items = specLossDetails
      .filter((d) => d.rowLoss > 0)
      .map((d) => ({
        gender: d.stock.gender,
        weightTier: d.stock.weightTier,
        lossCount: d.rowLoss,
      }));

    setLoading(true);
    try {
      const result = await batchRegisterOutboundLossAction({ items, reason });
      toast.success(
        `出库损耗 / 清库盘点已成功登记！共核减 ${result.totalLossRecorded} 只，涉及 ${result.results.length} 个规格`
      );
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "出库损耗登记失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={availableStocks.length === 0}>
          <ClipboardList className="size-3.5" />
          出库损耗 / 清库盘点
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* 头部 */}
        <DialogHeader className="p-4 pb-3 border-b bg-muted/10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardList className="size-4 text-primary" />
              出库损耗 / 清库盘点
            </DialogTitle>
            <Badge variant="secondary" className="font-mono text-[11px] h-5">
              共 {availableStocks.length} 个在库规格
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            平铺填报各规格挑残、死蟹损耗并核减可发库存；每日收尾清库时可点击【一键全清归零】快速结算。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 一键快捷操作工具栏 */}
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-primary/20 bg-primary/5 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkles className="size-3.5 text-primary" />
              <span>快速盘点工具：</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="h-7 text-xs gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
              >
                <Sparkles className="size-3" />
                一键全清归零 (收尾清库)
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetAll}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3" />
                一键全部无损
              </Button>
            </div>
          </div>

          {/* 各规格平铺列表 (参照捆扎明细行列表模式) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" />
                各规格损耗扣减与现场实盘
              </Label>
              <span className="text-[11px] text-muted-foreground">
                双向联动换算 · 实盘填 0 即完成该规格清库
              </span>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {specLossDetails.map(({ stock, rowLoss, rowPhysical, lossResult }) => {
                const key = getStockKey(stock);
                const isRowException = Boolean(lossResult.isException);

                return (
                  <div
                    key={key}
                    className="p-3 rounded-lg border bg-card hover:border-primary/40 transition-colors space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{stock.label}</span>
                        <Badge variant="outline" className="font-mono text-[10px] h-4.5 px-1.5">
                          盘前在库 {stock.available.toLocaleString()} 只
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRowZero(stock)}
                          className="text-[11px] text-primary hover:underline"
                        >
                          该规格清库归零
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <Label
                          htmlFor={`loss-${key}`}
                          className="text-[11px] font-semibold text-destructive flex items-center justify-between"
                        >
                          <span>本次损耗 / 剔除 *</span>
                          <span className="text-[10px] text-muted-foreground font-normal">直接扣减</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id={`loss-${key}`}
                            type="number"
                            min="0"
                            max={stock.available}
                            value={getLossInputValue(stock)}
                            onChange={(e) => handleLossChange(stock, e.target.value)}
                            className="h-8 pr-8 font-mono text-xs font-bold text-destructive"
                          />
                          <span className="absolute right-2.5 top-2 text-[11px] text-muted-foreground">只</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label
                          htmlFor={`physical-${key}`}
                          className="text-[11px] font-semibold text-foreground flex items-center justify-between"
                        >
                          <span>现场实盘可发 (联动)</span>
                          <span className="text-[10px] text-muted-foreground font-normal">填 0 清库</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id={`physical-${key}`}
                            type="number"
                            min="0"
                            max={stock.available}
                            value={physicalInputs[key] ?? String(stock.available)}
                            onChange={(e) => handlePhysicalChange(stock, e.target.value)}
                            className="h-8 pr-8 font-mono text-xs font-bold"
                          />
                          <span className="absolute right-2.5 top-2 text-[11px] text-muted-foreground">只</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono pt-1 border-t border-dashed">
                      <div>
                        登记后剩余:{" "}
                        <span className="font-semibold text-foreground">{rowPhysical.toLocaleString()} 只</span>
                        {rowLoss > 0 && (
                          <span className="text-destructive font-semibold ml-1.5">(-{rowLoss} 只)</span>
                        )}
                      </div>
                      <div>
                        规格累计损耗率:{" "}
                        <span className={isRowException ? "text-destructive font-bold" : ""}>
                          {Number(lossResult.lossRate).toFixed(2)}%
                        </span>
                        {isRowException && (
                          <span className="ml-1 text-[10px] text-destructive bg-destructive/10 px-1 py-0.2 rounded font-medium">
                            超标
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 全局汇总实时指标看板 (参照 CompleteBundleButton) */}
          <div className="p-3 rounded-lg border bg-muted/20 text-xs space-y-1.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              <div className="flex flex-col">
                <span className="text-muted-foreground text-[11px]">盘前可发总量</span>
                <span className="font-bold text-foreground text-sm">{totalAvailable.toLocaleString()} 只</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-[11px]">本次损耗总核减</span>
                <span className="font-bold text-destructive text-sm">
                  {totalLoss > 0 ? `-${totalLoss.toLocaleString()}` : "0"} 只
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-[11px]">最终实盘可发</span>
                <span className="font-bold text-primary text-sm">{totalPhysical.toLocaleString()} 只</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-[11px]">综合出库损耗率</span>
                <span className={`font-bold text-sm ${isHighLoss ? "text-destructive" : "text-emerald-600"}`}>
                  {Number(overallLossResult.lossRate).toFixed(2)}%
                </span>
              </div>
            </div>

            {isHighLoss && (
              <div className="pt-2 text-[11px] text-destructive flex items-center gap-1.5 font-medium border-t border-destructive/20">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>累计出库损耗率已超过 5% 警戒阈值，系统强制要求填写损耗原因说明留痕！</span>
              </div>
            )}
          </div>

          {/* 损耗原因录入区 */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <Label className="font-medium text-foreground">
                损耗与清库原因说明 {isHighLoss && <span className="text-destructive">*</span>}
              </Label>
              <span className="text-[10px] text-muted-foreground">点击快捷标签填入</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {PRESET_REASONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setReason(item)}
                  className="rounded border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {item}
                </button>
              ))}
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入本次发货损耗或收尾清库的具体原因..."
              className="min-h-[56px] text-xs resize-none"
              required={isHighLoss}
            />
          </div>
        </div>

        {/* 底部按钮栏 */}
        <div className="flex items-center justify-between p-3 border-t bg-muted/10">
          <div className="text-xs text-muted-foreground font-mono">
            {totalLoss > 0 ? (
              <span>
                本次待扣减损耗：<span className="text-destructive font-bold">{totalLoss} 只</span>
              </span>
            ) : (
              <span>暂无损耗扣减项</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={loading || totalLoss <= 0 || (isHighLoss && !reason.trim())}
              className="gap-1.5"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              确认登记盘点损耗 ({totalLoss} 只)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
