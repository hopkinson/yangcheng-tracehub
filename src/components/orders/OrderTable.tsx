"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderDeleteButton } from "@/components/orders/OrderDeleteButton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { batchDeleteOrdersAction } from "@/actions/production";
import { formatISODate } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function OrderTable({
  orders,
  targetDateStr,
}: {
  orders: any[];
  targetDateStr: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 仅待发货状态允许被批量删除
  const pendingOrders = orders.filter((o) => o.status === "PENDING");
  const isAllSelected =
    pendingOrders.length > 0 &&
    pendingOrders.every((o) => selectedIds.includes(o.id));

  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingOrders.map((o) => o.id));
    }
  };

  const handleToggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const res = await batchDeleteOrdersAction(selectedIds);
      if (res.success) {
        toast.success(res.message);
        setSelectedIds([]);
        setConfirmOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-mono">
            <tr>
              <th className="w-10 px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleAll}
                  disabled={pendingOrders.length === 0}
                  className="size-3.5 accent-primary cursor-pointer rounded align-middle"
                  title={
                    isAllSelected
                      ? "取消全选"
                      : "全选当前可撤销的待发货订单"
                  }
                />
              </th>
              <th className="px-3 py-2.5 font-medium">系统单号 / 批次</th>
              <th className="px-3 py-2.5 font-medium">原始单号 / 客户</th>
              <th className="px-3 py-2.5 font-medium">类型</th>
              <th className="px-3 py-2.5 font-medium">规格型号明细</th>
              <th className="px-3 py-2.5 font-medium">需求只数</th>
              <th className="px-3 py-2.5 font-medium">计划发货日</th>
              <th className="px-3 py-2.5 font-medium">状态</th>
              <th className="px-3 py-2.5 font-medium text-right min-w-[100px]">
                {selectedIds.length > 0 ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmOpen(true)}
                    disabled={isPending}
                    className="h-6 px-2 text-[11px] shadow-xs"
                    title="批量撤销所选订单"
                  >
                    <Trash2 className="size-3 mr-1" />
                    批量删除 ({selectedIds.length})
                  </Button>
                ) : (
                  "操作"
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="text-center py-8 text-muted-foreground"
                >
                  {targetDateStr === "all"
                    ? "暂无订单数据，请点击右上角「Excel 批量导入订单」"
                    : `所选发货日期（${targetDateStr}）暂无订单明细，可点击「全部」切换查看`}
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const isChecked = selectedIds.includes(order.id);
                const isPendingOrder = order.status === "PENDING";

                return (
                  <tr
                    key={order.id}
                    className={`transition-colors ${
                      isChecked
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <td className="w-10 px-3 py-2.5 text-center">
                      {isPendingOrder ? (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleOne(order.id)}
                          className="size-3.5 accent-primary cursor-pointer rounded align-middle"
                        />
                      ) : (
                        <span className="text-muted-foreground/30 text-[10px]">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono">
                      <div className="font-bold text-foreground">
                        {order.code}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {order.importId}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-medium text-foreground">
                        {order.orderNo}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                        {order.storeName}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-[10px]">
                        {order.type === "CRAB_CARD" ? "蟹卡提货" : "门店订单"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-primary">
                        {order.gender === "FEMALE" ? "母蟹" : "公蟹"}{" "}
                        {order.weightTier}
                      </span>
                      {order.specModel && (
                        <div
                          className="text-[10px] text-muted-foreground truncate max-w-[160px]"
                          title={order.specModel}
                        >
                          原始: {order.specModel}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-foreground">
                      {order.count} 只
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">
                      {formatISODate(order.deliveryDate)}
                    </td>
                    <td className="px-3 py-2.5">
                      {order.status === "SHIPPED" ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
                        >
                          已发货
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-amber-500 border-amber-500/30"
                        >
                          待发货
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {isPendingOrder && (
                        <OrderDeleteButton
                          importId={order.importId}
                          orderNo={order.orderNo}
                        />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确认批量撤销订单"
        description={`确定要批量撤销并删除已勾选的 ${selectedIds.length} 条待发货订单记录吗？\n\n删除后该批次明细将被清空，需重新导入。`}
        confirmText={`确认撤销 (${selectedIds.length}条)`}
        variant="destructive"
        loading={isPending}
        onConfirm={handleBatchDelete}
      />
    </>
  );
}
