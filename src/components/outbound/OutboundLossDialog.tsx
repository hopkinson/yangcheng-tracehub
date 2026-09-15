"use client";

import { useEffect, useState } from "react";
import { registerOutboundLossAction } from "@/actions/outbound";
import { Invariants } from "@/lib/invariants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ClipboardList, Loader2 } from "lucide-react";
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

const PRESET_REASONS = ["发货前死蟹", "装箱挑损", "残损不可发", "当日清库盘点结算"];

export function OutboundLossDialog({ specStocks }: { specStocks: SpecStock[] }) {
  const availableStocks = specStocks.filter((s) => s.available > 0);
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [lossInput, setLossInput] = useState("0");
  const [physicalInput, setPhysicalInput] = useState("0");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const currentStock = availableStocks.find((s) => `${s.gender}_${s.weightTier}` === selectedKey) || availableStocks[0];

  useEffect(() => {
    if (!open) return;
    const first = specStocks.find((stock) => stock.available > 0);
    setSelectedKey(first ? `${first.gender}_${first.weightTier}` : "");
    setLossInput("0");
    setPhysicalInput(first ? String(first.available) : "0");
    setReason("");
  }, [open, specStocks]);

  const numLoss = lossInput === "" ? 0 : Math.max(0, Math.floor(Number(lossInput) || 0));
  const boundedLoss = currentStock ? Math.min(numLoss, currentStock.available) : 0;
  const lossResult = currentStock
    ? Invariants.calculateLoss({
        bookInPool: currentStock.available,
        physicalCount: currentStock.available - boundedLoss,
        inPoolCount: currentStock.qualified,
        historicalLoss: currentStock.loss,
      })
    : { lossRate: 0, isException: false };
  const isHighLoss = Boolean(lossResult.isException);
  const isInvalidLoss = !currentStock || numLoss <= 0 || numLoss > currentStock.available;

  function handleSpecChange(value: string) {
    setSelectedKey(value);
    const stock = availableStocks.find((s) => `${s.gender}_${s.weightTier}` === value);
    if (!stock) return;
    setLossInput("0");
    setPhysicalInput(String(stock.available));
  }

  function handleLossChange(value: string) {
    setLossInput(value);
    if (!currentStock || value === "") {
      setPhysicalInput("");
      return;
    }
    const loss = Math.max(0, Math.floor(Number(value) || 0));
    setPhysicalInput(String(Math.max(0, currentStock.available - loss)));
  }

  function handlePhysicalChange(value: string) {
    setPhysicalInput(value);
    if (!currentStock || value === "") {
      setLossInput("");
      return;
    }
    const physical = Math.max(0, Math.floor(Number(value) || 0));
    setLossInput(String(Math.max(0, currentStock.available - physical)));
  }

  async function handleSubmit() {
    if (!currentStock || isInvalidLoss) {
      toast.error("请输入不超过当前可发库存的损耗数量");
      return;
    }
    if (isHighLoss && !reason.trim()) {
      toast.error("累计出库损耗率超 5%，请填写损耗原因");
      return;
    }

    setLoading(true);
    try {
      const result = await registerOutboundLossAction({
        gender: currentStock.gender,
        weightTier: currentStock.weightTier,
        lossCount: numLoss,
        reason,
      });
      toast.success(`出库损耗登记成功，当前可发库存剩余 ${result.availableAfter} 只`);
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">出库损耗 / 清库盘点</DialogTitle>
          <DialogDescription className="text-xs">
            记录发货前死蟹、残损并核减可发库存；每日收尾清库时，可将现场实盘填为 0 完成该规格清库。
          </DialogDescription>
        </DialogHeader>

        {currentStock && (
          <div className="flex flex-col gap-4 py-1 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="font-medium">盘点规格</label>
              <Select value={selectedKey} onValueChange={handleSpecChange}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择规格" />
                </SelectTrigger>
                <SelectContent>
                  {availableStocks.map((stock) => (
                    <SelectItem key={`${stock.gender}_${stock.weightTier}`} value={`${stock.gender}_${stock.weightTier}`}>
                      {stock.label} · 当前可发 {stock.available.toLocaleString()} 只
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-destructive">本次损耗 / 挑出死蟹 *</label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max={currentStock.available}
                    value={lossInput}
                    onChange={(e) => handleLossChange(e.target.value)}
                    className="pr-8 font-mono text-base font-bold text-destructive"
                    autoFocus
                  />
                  <span className="absolute right-2.5 top-2.5 text-muted-foreground">只</span>
                </div>
                <span className="text-[10px] text-muted-foreground">直接填写本次不可发数量</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold">现场实盘可发数（联动）</label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max={currentStock.available}
                    value={physicalInput}
                    onChange={(e) => handlePhysicalChange(e.target.value)}
                    className="pr-8 font-mono text-base font-bold"
                  />
                  <span className="absolute right-2.5 top-2.5 text-muted-foreground">只</span>
                </div>
                <span className="text-[10px] text-muted-foreground">或填写盘点后剩余可发数量</span>
                <button
                  type="button"
                  onClick={() => {
                    handlePhysicalChange("0");
                    setReason("当日清库盘点结算");
                  }}
                  className="text-[10px] text-primary hover:underline text-left"
                >
                  晚间清库：实盘归零
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 rounded-md border p-2.5 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">盘点前可发库存:</span>
                <span>{currentStock.available.toLocaleString()} 只</span>
              </div>
              <div className="flex justify-between font-semibold text-destructive">
                <span>本次损耗核减:</span>
                <span>-{numLoss.toLocaleString()} 只</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>登记后可发库存:</span>
                <span className="text-primary">{Math.max(0, currentStock.available - numLoss).toLocaleString()} 只</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>该规格累计出库损耗率:</span>
                <span className={isHighLoss ? "font-bold text-destructive" : ""}>{Number(lossResult.lossRate).toFixed(2)}%</span>
              </div>
            </div>

            {isHighLoss && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>累计出库损耗率超过 5%，本次必须填写具体损耗原因。</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-medium">损耗原因 {isHighLoss && <span className="text-destructive">*</span>}</label>
                <span className="text-[10px] text-muted-foreground">点击快捷填入</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {PRESET_REASONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setReason(item)}
                    className="rounded border border-border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请输入本次发货损耗的具体原因..."
                className="min-h-[64px] text-xs"
              />
            </div>

            {numLoss > currentStock.available && (
              <div className="text-destructive">损耗数量不能超过当前可发库存 {currentStock.available.toLocaleString()} 只。</div>
            )}

            <div className="flex justify-end gap-2 border-t pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
                取消
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={loading || isInvalidLoss || (isHighLoss && !reason.trim())}>
                {loading && <Loader2 className="size-3.5 animate-spin" />}
                确认登记损耗 ({numLoss} 只)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
