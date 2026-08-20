"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settleDailyTagClaimAction } from "@/actions/tags";
import { toast } from "sonner";
import { CheckCheck, AlertTriangle } from "lucide-react";

export function TagSettleDialog({
  claim,
  userId,
}: {
  claim: {
    id: string;
    farmer: { name: string; code: string };
    claimCount: number;
    boundCount: number;
    returnedCount: number;
    scrappedCount: number;
  };
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [boundCount, setBoundCount] = useState(String(claim.boundCount || claim.claimCount));
  const [returnedCount, setReturnedCount] = useState(String(claim.returnedCount || 0));
  const [returnReason, setReturnReason] = useState("");
  const [scrappedCount, setScrappedCount] = useState(String(claim.scrappedCount || 0));
  const [scrapReason, setScrapReason] = useState("");

  const numBound = parseInt(boundCount, 10) || 0;
  const numReturn = parseInt(returnedCount, 10) || 0;
  const numScrap = parseInt(scrappedCount, 10) || 0;
  const totalAccounted = numBound + numReturn + numScrap;
  const diff = claim.claimCount - totalAccounted;
  const isBalanced = diff === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (!isBalanced) {
        throw new Error(`数量未轧平！领扣 ${claim.claimCount} 只，已核销 ${totalAccounted} 只，差额 ${diff} 只。`);
      }

      await settleDailyTagClaimAction({
        tagClaimId: claim.id,
        boundCount: numBound,
        returnedCount: numReturn,
        returnReason,
        scrappedCount: numScrap,
        scrapReason,
        operatorId: userId,
      });

      toast.success("当日蟹扣核销已成功轧平结单！");
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "轧平失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CheckCheck className="size-3.5" data-icon="inline-start" />
          日结轧平
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>蟹扣日清日结核销对账</DialogTitle>
          <DialogDescription>
            养殖户: <span className="font-semibold text-foreground">{claim.farmer.name} ({claim.farmer.code})</span> · 当日领扣: <span className="font-bold text-primary font-mono">{claim.claimCount} 只</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="rounded-md border bg-muted/40 p-3 text-xs flex flex-col gap-1.5 font-mono">
            <div className="flex justify-between font-semibold">
              <span>轧平公式:</span>
              <span>领扣数 = 当日绑扣出库 + 当日退回 + 当日作废</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span>待核销领扣总量:</span>
              <span className="font-bold text-foreground">{claim.claimCount} 只</span>
            </div>
            <div className="flex justify-between">
              <span>当前核销合计:</span>
              <span className={isBalanced ? "text-emerald-600 font-bold" : "text-destructive font-bold"}>
                {totalAccounted} 只 ({isBalanced ? "已轧平" : `差额 ${diff} 只`})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">绑扣出库数</Label>
              <Input
                type="number"
                value={boundCount}
                onChange={(e) => setBoundCount(e.target.value)}
                min="0"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">退回数</Label>
              <Input
                type="number"
                value={returnedCount}
                onChange={(e) => setReturnedCount(e.target.value)}
                min="0"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">作废数</Label>
              <Input
                type="number"
                value={scrappedCount}
                onChange={(e) => setScrappedCount(e.target.value)}
                min="0"
                required
              />
            </div>
          </div>

          {numReturn > 0 && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">退回原因</Label>
              <Input
                placeholder="如: 批次微瑕退回重整"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                required
              />
            </div>
          )}

          {numScrap > 0 && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">作废原因</Label>
              <Input
                placeholder="如: 打包挤压断扣"
                value={scrapReason}
                onChange={(e) => setScrapReason(e.target.value)}
                required
              />
            </div>
          )}

          {!isBalanced && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>未轧平！请调整出库数、退回数或作废数，直至差额为 0。</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading || !isBalanced}>
              {loading ? "结单中..." : "确认轧平结单"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
