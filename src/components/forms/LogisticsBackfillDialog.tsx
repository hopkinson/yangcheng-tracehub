"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLogisticsAction } from "@/actions/outbound";
import { toast } from "sonner";
import { Truck } from "lucide-react";

export function LogisticsBackfillDialog({
  order,
  userId,
  userName,
}: {
  order: {
    id: string;
    code: string;
    logisticsNo: string | null;
  };
  userId: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logisticsNo, setLogisticsNo] = useState(order.logisticsNo === "待生成" ? "" : order.logisticsNo || "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (!logisticsNo.trim()) throw new Error("请输入有效的快递/物流单号");

      await updateLogisticsAction({
        orderId: order.id,
        logisticsNo: logisticsNo.trim(),
        operatorId: userId,
        operatorName: userName,
      });

      toast.success("物流单号回填成功！");
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "回填失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Truck className="size-3.5" data-icon="inline-start" />
          {order.logisticsNo && order.logisticsNo !== "待生成" ? "修改物流" : "回填物流"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>物流运单号回填与留痕</DialogTitle>
          <DialogDescription>
            出库单号: <span className="font-mono font-medium text-foreground">{order.code}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>快递/冷链物流单号 (如顺丰/京东)</Label>
            <Input
              placeholder="如: SF10882391029"
              value={logisticsNo}
              onChange={(e) => setLogisticsNo(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "提交中..." : "确认回填"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
