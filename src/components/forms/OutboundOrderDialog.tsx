"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createOutboundOrderAction } from "@/actions/outbound";
import { toast } from "sonner";
import { Plus, Truck } from "lucide-react";

export function OutboundOrderDialog({
  batches,
  stores,
  userId,
}: {
  batches: Array<{
    id: string;
    code: string;
    gender: string;
    weightTier: string;
    farmer: { name: string };
    pool: { code: string };
    liveInPool: number;
  }>;
  stores: Array<{
    id: string;
    code: string;
    name: string;
    channel: { name: string };
  }>;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedBatchId, setSelectedBatchId] = useState(batches[0]?.id || "");
  const [selectedStoreId, setSelectedStoreId] = useState(stores[0]?.id || "");
  const [outboundCount, setOutboundCount] = useState("500");

  const currentBatch = batches.find((b) => b.id === selectedBatchId);
  const maxAvailable = currentBatch ? currentBatch.liveInPool : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const count = parseInt(outboundCount, 10);
      if (isNaN(count) || count <= 0) throw new Error("请输入有效的出库数量");
      if (count > maxAvailable) throw new Error(`在池存活不足: 当前批次仅剩 ${maxAvailable} 只`);

      await createOutboundOrderAction({
        batchId: selectedBatchId,
        storeId: selectedStoreId,
        outboundCount: count,
        channelOrderCount: count, // 单票数量强一致
        applicantId: userId,
      });

      toast.success("出库申请提交成功，已提交品控主管审批！");
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "申请失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="size-4" data-icon="inline-start" />
          出库发货申请
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            <DialogTitle>大闸蟹出库打包申请</DialogTitle>
          </div>
          <DialogDescription>
            单票核对：出库数量必须与渠道订单数量严格一致，且不得超过批次在池存活数。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>选择出库原料批次</Label>
            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
              <SelectTrigger>
                <SelectValue placeholder="选择批次" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.code} ({b.farmer.name} · {b.gender === "MALE" ? "公" : "母"}{b.weightTier} · 存活:{b.liveInPool}只)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>目标销售门店 (从主档选择)</Label>
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="选择门店" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    [{s.channel.name}] {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentBatch && (
            <div className="rounded-lg border bg-muted/40 p-3 text-xs flex flex-col gap-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">来源养殖户:</span>
                <span>{currentBatch.farmer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">暂养池仓位:</span>
                <span>{currentBatch.pool.code}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold text-emerald-600">
                <span>该批次在池存活上限:</span>
                <span className="text-sm">{maxAvailable.toLocaleString()} 只</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>出库发运数量 (只) - 自动同步单票订单数</Label>
            <Input
              type="number"
              value={outboundCount}
              onChange={(e) => setOutboundCount(e.target.value)}
              min="1"
              max={maxAvailable}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading || maxAvailable <= 0}>
              {loading ? "提交中..." : "确认提交出库单"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
