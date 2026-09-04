"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Truck, Store, Calendar, User, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDateTime, cn } from "@/lib/utils";
import { getTenant } from "@/config/tenant";

export function OutboundDetailDialog({
  order,
}: {
  order: {
    id: string;
    code: string;
    type: string;
    storeName?: string | null;
    channelName?: string | null;
    coldLogCode?: string | null;
    coldStoreName?: string | null;
    outboundCount: number;
    logisticsNo?: string | null;
    status: string;
    applicantName?: string | null;
    approverName?: string | null;
    approvalComment?: string | null;
    approvedAt?: Date | string | null;
    createdAt: Date | string;
    lines: Array<{
      id: string;
      orderNo: string;
      gender: string;
      weightTier: string;
      count: number;
      expressCompany?: string | null;
      waybillNo?: string | null;
    }>;
  };
}) {
  const [open, setOpen] = useState(false);
  const isStore = order.type === "STORE_ORDER";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] gap-1 text-muted-foreground hover:text-foreground">
          <FileText className="size-3" />
          详情
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-semibold font-mono">
              {order.code}
            </DialogTitle>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-medium px-2 py-0.5",
                isStore
                  ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
                  : "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30"
              )}
            >
              {isStore ? "门店订单" : "提蟹订单"}
            </Badge>
            <Badge
              variant={
                order.status === "APPROVED"
                  ? "default"
                  : order.status === "REJECTED"
                  ? "destructive"
                  : "secondary"
              }
              className={cn(
                "text-[10px] font-normal",
                order.status === "PENDING" && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                order.status === "APPROVED" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
              )}
            >
              {order.status === "APPROVED" ? "已出库" : order.status === "REJECTED" ? "已驳回" : "待审核"}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            出库单基础信息、审核流与逐行明细物流
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto px-1 py-1 text-xs">
          {/* 基本信息面板 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg border bg-muted/20">
            <div>
              <span className="text-[11px] text-muted-foreground block">去向 / 门店</span>
              <span className="font-medium text-foreground">{order.storeName || (isStore ? getTenant().storeLabel : "蟹卡直发")}</span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">出库总只数</span>
              <span className="font-mono font-bold text-primary">{order.outboundCount} 只</span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">申请时间</span>
              <span className="font-mono text-muted-foreground">{formatDateTime(order.createdAt)}</span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">物流总状态</span>
              <span className="font-mono font-medium truncate block" title={order.logisticsNo || ""}>
                {order.logisticsNo || (isStore ? "门店自配" : "发货后回填")}
              </span>
            </div>
          </div>

          {order.coldLogCode && (
            <div className="px-3 py-2 rounded-lg border bg-muted/15 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">出库调拨保鲜批次:</span>
                <span className="font-bold text-foreground">{order.coldLogCode}</span>
                {order.coldStoreName && (
                  <Badge variant="outline" className="text-[10px]">
                    {order.coldStoreName}
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">冷库预冷锁鲜成品调拨</span>
            </div>
          )}

          {/* 审批留痕卡片 */}
          <div className="p-3 rounded-lg border bg-muted/10 space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              {order.status === "APPROVED" ? (
                <CheckCircle2 className="size-3.5 text-emerald-600" />
              ) : order.status === "REJECTED" ? (
                <XCircle className="size-3.5 text-destructive" />
              ) : (
                <Clock className="size-3.5 text-amber-500" />
              )}
              <span>审核流留痕</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground font-mono">
              <div>审核状态：{order.status === "APPROVED" ? "准予出库" : order.status === "REJECTED" ? "已驳回" : "等待审核中"}</div>
              <div>审核人：{order.approverName || (order.status === "PENDING" ? "待审核" : "系统审核")}</div>
              <div>审核时间：{order.approvedAt ? formatDateTime(order.approvedAt) : "—"}</div>
            </div>
            {order.approvalComment && (
              <div className="text-[11px] text-muted-foreground bg-background p-2 rounded border mt-1">
                审核意见：{order.approvalComment}
              </div>
            )}
          </div>

          {/* 逐行出库明细与物流 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground">逐行出库明细 ({order.lines.length} 笔)</span>
            </div>
            <div className="rounded border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[120px] text-[11px]">原始单号</TableHead>
                    <TableHead className="w-[110px] text-[11px]">公母规格</TableHead>
                    <TableHead className="w-[80px] text-[11px]">只数</TableHead>
                    <TableHead className="min-w-[140px] text-[11px]">快递公司 / 运单号</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.orderNo}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-muted/80 text-[10px] border">
                          {l.gender === "FEMALE" ? "母" : "公"}{l.weightTier}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-xs">{l.count} 只</TableCell>
                      <TableCell className="font-mono text-xs">
                        {isStore ? (
                          <span className="text-muted-foreground">门店自配专车</span>
                        ) : l.waybillNo ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-1 bg-emerald-500/10 text-emerald-600 rounded border border-emerald-500/20">
                              {l.expressCompany || "顺丰速运"}
                            </span>
                            <span className="font-medium text-foreground">{l.waybillNo}</span>
                          </div>
                        ) : (
                          <span className="text-amber-600 text-[11px]">待回填运单号</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
