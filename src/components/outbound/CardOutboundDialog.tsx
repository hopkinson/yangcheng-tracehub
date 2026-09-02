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
import { ShoppingBag, Loader2, AlertTriangle } from "lucide-react";
import { createCardUnifiedOutboundAction } from "@/actions/outbound";
import { BatchLineageSelect, type RawBatchOption } from "./BatchLineageSelect";

export interface SpecStockInfo {
  gender: string;
  weightTier: string;
  available: number;
}

export function CardOutboundDialog({
  pendingCardOrders,
  specStocks = [],
  rawBatches = [],
  userId,
}: {
  pendingCardOrders: Array<{
    id: string;
    orderNo: string;
    gender: string;
    weightTier: string;
    count: number;
    deliveryDate: Date | string;
  }>;
  specStocks?: SpecStockInfo[];
  rawBatches?: RawBatchOption[];
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [transportCompany, setTransportCompany] = useState("顺丰冷运速递");

  const [selectedBatchId, setSelectedBatchId] = useState(rawBatches[0]?.id || "");

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const handleToggleOrder = (orderId: string) => {
    if (selectedOrderIds.includes(orderId)) {
      setSelectedOrderIds(selectedOrderIds.filter((id) => id !== orderId));
    } else {
      setSelectedOrderIds([...selectedOrderIds, orderId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedOrderIds.length === pendingCardOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(pendingCardOrders.map((o) => o.id));
    }
  };

  const getSpecAvailable = (gender: string, weightTier: string) => {
    const stock = specStocks.find((s) => s.gender === gender && s.weightTier === weightTier);
    return stock ? stock.available : 0;
  };

  const selectedOrders = pendingCardOrders.filter((o) => selectedOrderIds.includes(o.id));
  const totalCrabs = selectedOrders.reduce((acc, cur) => acc + cur.count, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrderIds.length === 0) {
      toast.error("请至少勾选一个待发货提蟹订单");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createCardUnifiedOutboundAction({
          orderIds: selectedOrderIds,
          batchId: selectedBatchId || undefined,
          transportCompany,
          applicantId: userId,
        });

        toast.success(`提蟹统一出库单 ${res.code} 生成成功（包含 ${selectedOrderIds.length} 笔提蟹共 ${totalCrabs} 只）`);
        setOpen(false);
      } catch (err: any) {
        toast.error(err.message || "统一出库失败");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && selectedOrderIds.length === 0 && pendingCardOrders.length > 0) {
          setSelectedOrderIds(pendingCardOrders.map((o) => o.id));
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-9 gap-1.5 font-medium shadow-xs">
          <ShoppingBag className="size-4 text-primary" />
          提蟹统一出库申请 (CK)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <ShoppingBag className="size-5 text-primary" />
            提蟹订单统一出库申请
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            将待发货的蟹卡提蟹订单统一合并为一张出库单（逐单生成明细行），发货后支持批量回填物流单号。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 flex-1 overflow-y-auto px-1 py-1">
          <div className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">承运快递服务商</Label>
              <Input
                value={transportCompany}
                onChange={(e) => setTransportCompany(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-4 text-xs font-mono pr-2">
              <div>
                <span className="text-[11px] text-muted-foreground block">已选订单</span>
                <span className="text-sm font-bold text-foreground">{selectedOrderIds.length} / {pendingCardOrders.length} 单</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">合计只数</span>
                <span className="text-sm font-bold text-primary">{totalCrabs} 只</span>
              </div>
            </div>
          </div>

          {/* 关联原料批次确认卡片 */}
          <BatchLineageSelect
            rawBatches={rawBatches}
            selectedBatchId={selectedBatchId}
            onSelectBatchId={setSelectedBatchId}
          />

          {/* 提蟹订单列表 */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/10">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">待发货提蟹订单列表</Label>
              {pendingCardOrders.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-6 text-[11px]"
                >
                  {selectedOrderIds.length === pendingCardOrders.length ? "取消全选" : "全选（统一出库）"}
                </Button>
              )}
            </div>

            {pendingCardOrders.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded">
                暂无待发货提蟹订单
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {pendingCardOrders.map((ord) => {
                  const isChecked = selectedOrderIds.includes(ord.id);
                  const avail = getSpecAvailable(ord.gender, ord.weightTier);
                  const isInsufficient = avail < ord.count;

                  return (
                    <div
                      key={ord.id}
                      onClick={() => handleToggleOrder(ord.id)}
                      className={`flex items-center justify-between p-2 rounded border text-xs cursor-pointer transition-colors ${
                        isChecked ? "bg-primary/10 border-primary/40 font-medium" : "bg-background"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="size-3.5 accent-primary"
                        />
                        <span className="font-mono font-bold">{ord.orderNo}</span>
                        <span className="text-muted-foreground font-mono">
                          {ord.gender === "FEMALE" ? "母蟹" : "公蟹"} {ord.weightTier} · {ord.count}只
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-[11px] text-muted-foreground">
                          冷库可出 <strong className="text-foreground">{avail}</strong> 只
                        </span>
                        {isInsufficient && (
                          <span className="text-xs font-bold text-destructive flex items-center gap-0.5">
                            <AlertTriangle className="size-3" />
                            (不足)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
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
              disabled={isPending || selectedOrderIds.length === 0}
              className="gap-1 bg-primary text-primary-foreground font-medium"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              生成统一出库单 ({totalCrabs} 只)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
