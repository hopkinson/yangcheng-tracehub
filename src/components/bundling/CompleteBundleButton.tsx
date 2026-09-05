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
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, AlertTriangle, Layers } from "lucide-react";
import { completeBundleBatchAction } from "@/actions/production";
import { Invariants } from "@/lib/invariants";

export interface BundleLineItem {
  id: string;
  pool?: { code: string; name: string };
  gender: string;
  weightTier: string;
  count: number;
}

export function CompleteBundleButton({
  bundleId,
  code,
  lines,
}: {
  bundleId: string;
  code: string;
  lines: BundleLineItem[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 每行合格数状态，默认等于投入数
  const [lineCounts, setLineCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.count]))
  );
  const [lossReason, setLossReason] = useState("");

  const totalInput = lines.reduce((acc, l) => acc + l.count, 0);
  const totalQualified = Object.values(lineCounts).reduce((acc, c) => acc + (c || 0), 0);

  const lossRes = Invariants.calculateBundleLoss({
    inputCount: totalInput,
    qualifiedCount: totalQualified,
  });

  const handleCountChange = (lineId: string, maxCount: number, val: number) => {
    setLineCounts((prev) => ({
      ...prev,
      [lineId]: isNaN(val) ? 0 : Math.max(0, Math.min(maxCount, val)),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalQualified > totalInput) {
      toast.error("合格总只数不能超过起池总投入数");
      return;
    }

    if (lossRes.isException && !lossReason.trim()) {
      toast.error("损耗率已超 5% 阈值，请务必填写损耗原因说明");
      return;
    }

    const payload = lines.map((l) => ({
      lineId: l.id,
      qualifiedCount: lineCounts[l.id] ?? l.count,
    }));

    startTransition(async () => {
      const res = await completeBundleBatchAction(bundleId, payload, lossReason);
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
        <Button
          size="sm"
          className="h-6 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
        >
          <CheckCircle2 className="size-3" />
          完成捆扎
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="size-5 text-emerald-600" />
            确认捆扎完成与损耗结算
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            捆扎批次号：{code} · 投入起池只数：{totalInput} 只
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* 明细行合格数录入 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">各规格实际合格只数录入</Label>
              <span className="text-[11px] text-muted-foreground">剔除死蟹、断螯及残次品</span>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {lines.map((l) => {
                const lineLoss = l.count - (lineCounts[l.id] || 0);
                const genderText = l.gender === "FEMALE" ? "母蟹" : "公蟹";
                const poolText = l.pool ? `${l.pool.name || l.pool.code} · ` : "";
                return (
                  <div
                    key={l.id}
                    className="p-2.5 rounded-lg border bg-muted/30 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Layers className="size-3.5 text-primary" />
                        <span>{poolText}{genderText} {l.weightTier}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        投入起池：{l.count} 只 · 损耗：{lineLoss > 0 ? `${lineLoss} 只` : "无"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Label htmlFor={`line-${l.id}`} className="text-[11px] text-muted-foreground">
                        合格只数:
                      </Label>
                      <Input
                        id={`line-${l.id}`}
                        type="number"
                        min={0}
                        max={l.count}
                        value={lineCounts[l.id] ?? ""}
                        onChange={(e) =>
                          handleCountChange(l.id, l.count, parseInt(e.target.value, 10))
                        }
                        className="h-8 w-24 text-right font-mono font-bold text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 实时损耗指标看板 */}
          <div className="p-3 rounded-lg border text-xs space-y-1 bg-muted/20">
            <div className="flex items-center justify-between font-mono">
              <span className="text-muted-foreground">起池总投入：</span>
              <span className="font-bold text-foreground">{totalInput} 只</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-muted-foreground">最终捆扎合格：</span>
              <span className="font-bold text-primary">{totalQualified} 只</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-muted-foreground">自动结算损耗只数：</span>
              <span className="font-bold text-foreground">{lossRes.lossCount} 只</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-muted-foreground">本次捆扎损耗率：</span>
              <span
                className={`font-bold text-sm ${
                  lossRes.isException ? "text-destructive" : "text-emerald-600"
                }`}
              >
                {lossRes.lossRate}%
              </span>
            </div>

            {lossRes.isException && (
              <div className="pt-2 text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertTriangle className="size-3.5 shrink-0" />
                损耗率已超过 5% 警戒阈值，系统将标红预警并要求留痕！
              </div>
            )}
          </div>

          {/* 超过 5% 阈值必须录入原因 */}
          {lossRes.isException && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-destructive">
                异常损耗原因说明 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="请详细记录死蟹、断螯淘汰或现场异常原因（必填）..."
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                rows={2}
                className="text-xs"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                isPending ||
                totalQualified > totalInput ||
                (lossRes.isException && !lossReason.trim())
              }
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              确认结算并完成捆扎 ({totalQualified} 只)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
