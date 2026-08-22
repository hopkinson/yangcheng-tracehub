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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BatchReportViewDialog } from "@/components/batches/BatchReportViewDialog";
import { BatchReportUploadDialog } from "@/components/batches/BatchReportUploadDialog";
import {
  Layers,
  MapPin,
  Waves,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Truck,
  Eye,
} from "lucide-react";

export interface BatchDetailDialogProps {
  batch: {
    id: string;
    code: string;
    gender: string;
    weightTier: string;
    inPoolTime: Date | string;
    inPoolCount: number;
    outPoolCount: number;
    lossCount: number;
    status: string;
    isException: boolean;
    exceptionReason?: string | null;
    reportUrl?: string | null;
    reportName?: string | null;
    reportUploadedAt?: Date | string | null;
    farmer: {
      id: string;
      name: string;
      code: string;
      area: number;
      farmType: string;
      quota: number;
    };
    enclosure: {
      id: string;
      code: string;
    };
    pool: {
      id: string;
      name: string;
      code: string;
    };
    lossRecords?: Array<{
      id: string;
      inventoryDate: Date | string;
      lossCount: number;
      reason: string;
    }>;
    outboundOrders?: Array<{
      id: string;
      code: string;
      outboundCount: number;
      status: string;
      createdAt: Date | string;
      store?: { name: string } | null;
    }>;
  };
  trigger?: React.ReactNode;
  userId?: string;
  isWarehouseOrAdmin?: boolean;
}

export function BatchDetailDialog({
  batch,
  trigger,
  userId,
  isWarehouseOrAdmin,
}: BatchDetailDialogProps) {
  const [open, setOpen] = useState(false);

  const liveInPool = batch.inPoolCount - batch.outPoolCount - batch.lossCount;
  const lossRate = batch.inPoolCount > 0 ? ((batch.lossCount / batch.inPoolCount) * 100).toFixed(1) : "0.0";
  const isLossOverLimit = Number(lossRate) > 5;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
            <Eye className="size-3.5" />
            详情
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              <DialogTitle className="text-base font-bold font-mono">
                原料批次档案 · {batch.code}
              </DialogTitle>
            </div>
            <Badge
              variant={
                batch.status === "FROZEN"
                  ? "destructive"
                  : batch.status === "TEMPORARY_HOLDING"
                  ? "default"
                  : batch.status === "PARTIALLY_OUTBOUND"
                  ? "secondary"
                  : "outline"
              }
            >
              {batch.status === "FROZEN"
                ? "异常冻结"
                : batch.status === "TEMPORARY_HOLDING"
                ? "暂养中"
                : batch.status === "PARTIALLY_OUTBOUND"
                ? "部分出库"
                : "已完成"}
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            入池登记时间：{new Date(batch.inPoolTime).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 text-xs">
          {/* 1. 数量闭环四项指标卡 */}
          <div className="grid grid-cols-4 gap-2 rounded-lg border bg-muted/20 p-3 text-center">
            <div>
              <span className="text-muted-foreground">初始入池数量</span>
              <p className="text-sm font-bold font-mono mt-0.5">{batch.inPoolCount.toLocaleString()} 只</p>
            </div>
            <div>
              <span className="text-muted-foreground">已出库发运数</span>
              <p className="text-sm font-bold font-mono mt-0.5">{batch.outPoolCount.toLocaleString()} 只</p>
            </div>
            <div>
              <span className="text-muted-foreground">累计盘点损耗</span>
              <p className={`text-sm font-bold font-mono mt-0.5 ${isLossOverLimit ? "text-destructive" : ""}`}>
                {batch.lossCount.toLocaleString()} 只 ({lossRate}%)
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">当前账面在池</span>
              <p className="text-base font-bold font-mono text-emerald-600 mt-0.5">{liveInPool.toLocaleString()} 只</p>
            </div>
          </div>

          {/* 2. 源头养殖与暂养仓位 */}
          <div className="rounded-lg border p-3.5 flex flex-col gap-2.5">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="size-4 text-primary" />
              源头养殖与暂养仓位
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-muted-foreground">签约养殖户：</span>
                <p className="font-medium mt-0.5">{batch.farmer.name} ({batch.farmer.code})</p>
              </div>
              <div>
                <span className="text-muted-foreground">养殖类型 / 面积：</span>
                <p className="font-medium mt-0.5">
                  {batch.farmer.farmType === "LAKE_CRAB" ? "阳澄湖核心区" : "生态塘"} · {batch.farmer.area} 亩
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">围网水域编号：</span>
                <p className="font-medium font-mono mt-0.5">{batch.enclosure.code}</p>
              </div>
              <div>
                <span className="text-muted-foreground">暂养池仓位：</span>
                <p className="font-medium mt-0.5">{batch.pool.name} ({batch.pool.code})</p>
              </div>
              <div>
                <span className="text-muted-foreground">公母规格：</span>
                <p className="font-medium mt-0.5">
                  {batch.gender === "MALE" ? "公蟹" : "母蟹"} · {batch.weightTier}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">养殖户总核定额度：</span>
                <p className="font-medium font-mono text-primary mt-0.5">{batch.farmer.quota.toLocaleString()} 只</p>
              </div>
            </div>
          </div>

          {/* 3. 品控监测报告 */}
          <div className="rounded-lg border p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileText className="size-5 text-primary" />
              <div>
                <div className="font-medium">
                  {batch.reportName || "产地准出 / 药残监测报告"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {batch.reportUrl
                    ? `已上传 (更新时间: ${batch.reportUploadedAt ? new Date(batch.reportUploadedAt).toLocaleString() : "已绑定"})`
                    : "暂未上传监测报告"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {batch.reportUrl ? (
                <BatchReportViewDialog
                  batchCode={batch.code}
                  reportName={batch.reportName || "检测报告"}
                  reportUrl={batch.reportUrl}
                />
              ) : null}
              {isWarehouseOrAdmin && userId && (
                <BatchReportUploadDialog
                  batchId={batch.id}
                  batchCode={batch.code}
                  currentReportName={batch.reportName}
                  userId={userId}
                />
              )}
            </div>
          </div>

          {/* 4. 损耗异常预警 (若有) */}
          {batch.isException && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">【品控异常预警】损耗超标复核：</span>
                <p className="opacity-90">{batch.exceptionReason || "批次累计损耗率已超过 5% 告警线，请及时分析排查！"}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
