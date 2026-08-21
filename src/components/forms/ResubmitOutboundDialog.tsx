"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resubmitOutboundOrderAction } from "@/actions/outbound";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

export function ResubmitOutboundDialog({
  order,
  stores,
  userId,
}: {
  order: {
    id: string;
    code: string;
    outboundCount: number;
    storeId: string;
    rejectReason?: string | null;
    batch: { code: string; inPoolCount: number; outPoolCount: number; lossCount: number };
  };
  stores: Array<{ id: string; name: string; code: string; channel: { name: string } }>;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState(order.storeId);
  const [outboundCount, setOutboundCount] = useState(String(order.outboundCount));

  const liveInBatch = order.batch.inPoolCount - order.batch.outPoolCount - order.batch.lossCount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const count = parseInt(outboundCount, 10);
    if (isNaN(count) || count <= 0) {
      toast.error("请输入有效的出库数量");
      return;
    }

    setLoading(true);
    try {
      await resubmitOutboundOrderAction({
        orderId: order.id,
        storeId,
        outboundCount: count,
        applicantId: userId,
      });
      toast.success("出库申请已重新提交，请等待品控审批！");
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "重新提交失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-primary">
          <RefreshCw className="size-3" />
          修改重提
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>修改并重新提报出库单 ({order.code})</DialogTitle>
          <DialogDescription>
            关联批次：{order.batch.code} (当前在池存活 {liveInBatch} 只)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          {order.rejectReason && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              <span className="font-semibold">此前品控驳回原因：</span> {order.rejectReason}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>目标销售门店</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="选择目标门店" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.channel.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>修正出库数量 (只)</Label>
            <Input
              type="number"
              min="1"
              max={liveInBatch}
              value={outboundCount}
              onChange={(e) => setOutboundCount(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "提交中..." : "重新提报"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
