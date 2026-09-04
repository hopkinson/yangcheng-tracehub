"use client";

import { useState, useTransition, useMemo } from "react";
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
import { Plus, Loader2, Store as StoreIcon, AlertTriangle } from "lucide-react";
import { createStoreOutboundAction } from "@/actions/outbound";
import { ColdBatchSelect, type ColdBatchOption } from "./BatchLineageSelect";

export interface PendingOrderOption {
  id: string;
  orderNo: string;
  storeName?: string | null;
  storeId?: string | null;
  gender: string;
  weightTier: string;
  count: number;
}

export interface StoreOption {
  id: string;
  name: string;
  code: string;
}

export interface SpecStockInfo {
  gender: string;
  weightTier: string;
  available: number;
}

export function StoreOutboundDialog({
  stores,
  pendingOrders,
  specStocks = [],
  coldBatches = [],
  userId,
}: {
  stores: StoreOption[];
  pendingOrders: PendingOrderOption[];
  specStocks?: SpecStockInfo[];
  coldBatches?: ColdBatchOption[];
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [selectedBatchId, setSelectedBatchId] = useState(coldBatches[0]?.id || "");

  // 仅保留有待发货订单的门店可选（14.3 规范）
  const activeStores = useMemo(() => {
    const filtered = stores.filter((s) => pendingOrders.some((o) => o.storeId === s.id));
    return filtered.length > 0 ? filtered : stores;
  }, [stores, pendingOrders]);

  const [selectedStoreId, setSelectedStoreId] = useState(activeStores[0]?.id || stores[0]?.id || "");
  const [transportCompany, setTransportCompany] = useState("苏州市冷链物流专车");
  const [licensePlate, setLicensePlate] = useState("苏E·88888");

  // 当前选中门店的待发订单
  const currentStoreOrders = useMemo(() => {
    return pendingOrders.filter((o) => !o.storeId || o.storeId === selectedStoreId);
  }, [pendingOrders, selectedStoreId]);

  // 待勾选订单列表
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // 切换门店时联动
  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    const storeOrds = pendingOrders.filter((o) => !o.storeId || o.storeId === storeId);
    setSelectedOrderIds(storeOrds.map((o) => o.id));
  };

  const handleToggleOrder = (orderId: string) => {
    if (selectedOrderIds.includes(orderId)) {
      setSelectedOrderIds(selectedOrderIds.filter((id) => id !== orderId));
    } else {
      setSelectedOrderIds([...selectedOrderIds, orderId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedOrderIds.length === currentStoreOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(currentStoreOrders.map((o) => o.id));
    }
  };

  const getSpecAvailable = (gender: string, weightTier: string) => {
    const stock = specStocks.find((s) => s.gender === gender && s.weightTier === weightTier);
    return stock ? stock.available : 0;
  };

  const selectedOrders = currentStoreOrders.filter((o) => selectedOrderIds.includes(o.id));
  const totalCrabs = selectedOrders.reduce((acc, cur) => acc + cur.count, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId || selectedOrderIds.length === 0) {
      toast.error("请选择门店并勾选至少一个待发货订单");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createStoreOutboundAction({
          storeId: selectedStoreId,
          orderIds: selectedOrderIds,
          coldLogId: selectedBatchId || undefined,
          transportCompany,
          licensePlate,
          applicantId: userId,
        });

        toast.success(`出库申请 ${res.code} 提交成功（合单 ${selectedOrderIds.length} 笔共 ${totalCrabs} 只）`);
        setOpen(false);
      } catch (err: any) {
        toast.error(err.message || "出库申请失败");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && selectedOrderIds.length === 0 && currentStoreOrders.length > 0) {
          setSelectedOrderIds(currentStoreOrders.map((o) => o.id));
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-9 gap-1.5 bg-primary text-primary-foreground font-medium shadow-xs">
          <Plus className="size-4" />
          新建门店出库 (CK)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <StoreIcon className="size-5 text-primary" />
            新建门店出库（多单合单出库）
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            选定发货门店并勾选待发货订单，系统自动按规格汇总校验冷库可用库存（分拣合格累计 − 已出库占用）。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 flex-1 overflow-y-auto px-1 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-lg border bg-muted/20">
            <div className="space-y-1">
              <Label className="text-xs">发货目的门店 (仅有待发订单可选)</Label>
              <Select value={selectedStoreId} onValueChange={handleStoreChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="选择门店" />
                </SelectTrigger>
                <SelectContent>
                  {activeStores.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">承运物流公司</Label>
              <Input
                value={transportCompany}
                onChange={(e) => setTransportCompany(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">冷链车牌号</Label>
              <Input
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* 关联保鲜库预冷批次确认卡片 */}
          <ColdBatchSelect
            coldBatches={coldBatches}
            selectedBatchId={selectedBatchId}
            onSelectBatchId={setSelectedBatchId}
          />

          {/* 订单勾选列表 */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold">选择本次合单出库订单</Label>
                <span className="text-[11px] text-muted-foreground">({currentStoreOrders.length} 单可选)</span>
              </div>
              {currentStoreOrders.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-6 text-[11px]"
                >
                  {selectedOrderIds.length === currentStoreOrders.length ? "取消全选" : "一键全选"}
                </Button>
              )}
            </div>

            {currentStoreOrders.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded">
                该门店暂无待发货订单
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {currentStoreOrders.map((ord) => {
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
                          冷库该规格可出 <strong className="text-foreground">{avail}</strong> 只
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

            <div className="flex justify-between items-center pt-2 text-xs font-mono border-t">
              <span className="text-muted-foreground">已选中：{selectedOrderIds.length} 单</span>
              <span className="font-bold text-foreground">
                合计发货只数：<strong className="text-primary text-sm">{totalCrabs} 只</strong>
              </span>
            </div>
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
              确认合单并提交出库 ({totalCrabs} 只)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
