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
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  Layers,
  ThermometerSnowflake,
  ShieldCheck,
} from "lucide-react";
import { formatDateTime, cn } from "@/lib/utils";
import { approveOutboundLossAction } from "@/actions/approvals";
import { ApprovalActionDialog } from "@/components/forms/ApprovalActions";

export interface OutboundLossOrderDetail {
  id: string;
  code: string;
  inventoryDate: Date | string;
  totalLossCount: number;
  lossRate: number;
  isException: boolean;
  reason: string;
  status: string;
  rejectReason?: string | null;
  applicantName?: string | null;
  approverName?: string | null;
  approvalComment?: string | null;
  approvedAt?: Date | string | null;
  createdAt: Date | string;
  items: Array<{
    id: string;
    gender: string;
    weightTier: string;
    lossCount: number;
    lossRate: number;
    isException: boolean;
  }>;
  records?: Array<{
    id: string;
    gender: string;
    weightTier: string;
    count: number;
    coldLog?: {
      code: string;
      store?: {
        name: string;
        code: string;
      } | null;
    } | null;
  }>;
}

export function OutboundLossDetailDialog({
  order,
  canApprove = false,
  triggerLabel,
  triggerVariant = "ghost",
}: {
  order: OutboundLossOrderDetail;
  canApprove?: boolean;
  triggerLabel?: string;
  triggerVariant?: "ghost" | "outline" | "default";
}) {
  const [open, setOpen] = useState(false);

  const isPending = order.status === "PENDING";
  const isApproved = order.status === "APPROVED";
  const isRejected = order.status === "REJECTED";

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant={triggerVariant}
            size="sm"
            className={cn(
              "h-6 px-1.5 text-[11px] gap-1",
              isPending
                ? "text-amber-600 dark:text-amber-400 hover:text-amber-700 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="size-3" />
            {triggerLabel || (isPending ? "详情 (待审核)" : "详情")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <DialogTitle className="text-base font-semibold font-mono">
                {order.code}
              </DialogTitle>
              <Badge
                variant="outline"
                className="text-[10px] font-medium px-2 py-0.5 bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
              >
                损耗出库单
              </Badge>
              <Badge
                variant={isApproved ? "default" : isRejected ? "destructive" : "secondary"}
                className={cn(
                  "text-[10px] font-normal",
                  isPending && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                  isApproved && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                )}
              >
                {isPending && (
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse mr-1 inline-block" />
                )}
                {isApproved ? "已核销" : isRejected ? "已驳回" : "待审核"}
              </Badge>
              {order.isException && (
                <Badge
                  variant="destructive"
                  className="text-[10px] py-0 h-4 font-normal"
                >
                  损耗超标
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              发货前死蟹挑损/清库盘点核减，多规格明细与审核留痕
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 text-xs">
            {/* 1. 基本信息卡片 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/80">
              <div>
                <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                  <Calendar className="size-3" /> 盘点日期
                </span>
                <span className="font-mono font-medium text-foreground mt-0.5 block">
                  {formatDateTime(order.inventoryDate).slice(0, 10)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                  <User className="size-3" /> 申请仓管
                </span>
                <span className="font-medium text-foreground mt-0.5 block">
                  {order.applicantName || "仓管员"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                  <Layers className="size-3" /> 核减总数
                </span>
                <span className="font-mono font-bold text-destructive mt-0.5 block text-sm">
                  -{order.totalLossCount} 只
                </span>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                  <AlertTriangle className="size-3" /> 综合损耗率
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="font-mono font-bold text-foreground">
                    {order.lossRate.toFixed(1)}%
                  </span>
                  {order.isException && (
                    <span className="text-[10px] text-destructive bg-destructive/10 px-1 rounded font-semibold">
                      超标
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 原因说明 */}
            <div className="p-3 rounded-lg bg-muted/20 border border-border/70 space-y-1">
              <span className="text-muted-foreground text-[11px] font-medium">损耗原因说明：</span>
              <p className="text-foreground leading-relaxed">
                {order.reason || "无"}
              </p>
            </div>

            {/* 2. 多规格损耗明细表 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                  <ThermometerSnowflake className="size-3.5 text-primary" />
                  多规格损耗明细
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  共 {order.items.length} 个规格
                </span>
              </div>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[100px] text-xs">公母</TableHead>
                      <TableHead className="w-[120px] text-xs">重量档位</TableHead>
                      <TableHead className="w-[120px] text-xs">核减只数</TableHead>
                      <TableHead className="w-[100px] text-xs">单项损耗率</TableHead>
                      <TableHead className="text-right text-xs">风控判定</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => {
                      const isFemale = item.gender === "FEMALE";
                      return (
                        <TableRow key={item.id} className="text-xs">
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-medium",
                                isFemale
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                  : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
                              )}
                            >
                              {isFemale ? "母蟹" : "公蟹"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            {item.weightTier}
                          </TableCell>
                          <TableCell className="font-mono font-bold text-destructive">
                            -{item.lossCount} 只
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {item.lossRate ? `${item.lossRate.toFixed(1)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.isException ? (
                              <Badge variant="destructive" className="text-[10px] py-0 h-4">
                                超 5% 红线
                              </Badge>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center justify-end gap-0.5">
                                <CheckCircle2 className="size-3" /> 正常
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 3. 保鲜库 FIFO 批次来源明细 */}
            {order.records && order.records.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <Layers className="size-3.5 text-muted-foreground" />
                    保鲜库 FIFO 扣减批次
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {order.records.length} 笔入库记录拆分
                  </span>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 text-[11px]">
                        <TableHead className="w-[140px]">保鲜入库批次</TableHead>
                        <TableHead className="w-[120px]">所在库区</TableHead>
                        <TableHead className="w-[120px]">规格</TableHead>
                        <TableHead className="text-right">扣减只数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.records.map((rec, idx) => (
                        <TableRow key={rec.id || idx} className="text-xs">
                          <TableCell className="font-mono font-medium text-primary">
                            {rec.coldLog?.code || "CR-批次"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {rec.coldLog?.store?.name || rec.coldLog?.store?.code || "冷库"}
                          </TableCell>
                          <TableCell>
                            {rec.gender === "FEMALE" ? "母" : "公"}{rec.weightTier}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-destructive">
                            -{rec.count} 只
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 4. 审核轨迹与结果 */}
            <div className="p-3 rounded-lg border bg-muted/10 space-y-1.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <ShieldCheck className="size-3.5 text-primary" />
                审批流程轨迹
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-muted-foreground">申请时间：</span>
                  <span className="font-mono text-foreground">{formatDateTime(order.createdAt)}</span>
                </div>
                {order.approvedAt && (
                  <div>
                    <span className="text-muted-foreground">审核时间：</span>
                    <span className="font-mono text-foreground">{formatDateTime(order.approvedAt)}</span>
                  </div>
                )}
                {order.approverName && (
                  <div>
                    <span className="text-muted-foreground">审核人员：</span>
                    <span className="font-medium text-foreground">{order.approverName}</span>
                  </div>
                )}
                {order.approvalComment && (
                  <div>
                    <span className="text-muted-foreground">审核结论：</span>
                    <span className="text-foreground">{order.approvalComment}</span>
                  </div>
                )}
                {order.rejectReason && (
                  <div className="col-span-full">
                    <span className="text-destructive font-medium">驳回原因：</span>
                    <span className="text-destructive">{order.rejectReason}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 底部审批操作按钮 */}
          {isPending && canApprove && (
            <div className="flex items-center justify-between pt-3 border-t mt-2">
              <div className="text-[11px] text-amber-600 flex items-center gap-1">
                <Clock className="size-3.5" />
                当前损耗单待审核，审批通过后完成核销，驳回将释放库存锁定
              </div>
              <ApprovalActionDialog
                title={`损耗出库单 [${order.code}]`}
                defaultApproveComment="审核通过，准予出库损耗核销"
                onConfirm={async (approved, comment) => {
                  await approveOutboundLossAction({
                    lossOrderId: order.id,
                    approved,
                    comment: approved ? comment : undefined,
                    rejectReason: !approved ? comment : undefined,
                  });
                  setOpen(false);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
