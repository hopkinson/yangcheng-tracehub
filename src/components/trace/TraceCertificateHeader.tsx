"use client";

import * as React from "react";
import { ShieldCheck, FileText, Truck, Calendar, Store, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PrintTraceButton } from "@/components/trace/PrintTraceButton";
import { TraceQueryResult } from "@/lib/trace-service";

interface TraceCertificateHeaderProps {
  data: TraceQueryResult;
}

export function TraceCertificateHeader({ data }: TraceCertificateHeaderProps) {
  const { isPreview, orderInfo, outboundInfo, farmerInfo } = data;

  return (
    <div className="rounded-xl border bg-card p-4 md:p-5 shadow-xs flex flex-col gap-4">
      {/* 头部标题与状态 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl ${
              isPreview
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-foreground">
                {orderInfo ? orderInfo.orderNo : outboundInfo?.code}
              </span>
              {orderInfo && (
                <span className="text-xs font-mono text-muted-foreground">
                  (系统单号: {orderInfo.code})
                </span>
              )}
              <Badge
                variant="outline"
                className={`text-xs py-0.5 ${
                  isPreview
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                }`}
              >
                {isPreview ? "待出库 · 履约链路预览" : "全链路已核验真"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              签约农户: <strong className="text-foreground">{farmerInfo.name}</strong> ({farmerInfo.code}) · 
              额度: {farmerInfo.quota.toLocaleString()} 只 · 围网: {farmerInfo.enclosureCode}
            </div>
          </div>
        </div>

        <div className="print:hidden flex items-center gap-2">
          <PrintTraceButton />
        </div>
      </div>

      {/* 结构化信息卡片 */}
      {orderInfo ? (
        /* 1. 订单视角信息卡 */
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50">
            <div className="text-muted-foreground text-[11px] flex items-center gap-1">
              <Store className="size-3" />
              客户 / 门店
            </div>
            <div className="font-bold text-foreground text-sm truncate mt-0.5" title={orderInfo.storeName}>
              {orderInfo.storeName}
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50">
            <div className="text-muted-foreground text-[11px] flex items-center gap-1">
              <Tag className="size-3" />
              规格 / 型号
            </div>
            <div className="font-bold text-foreground text-sm mt-0.5">
              {orderInfo.specModel || `${orderInfo.weightTier} · ${orderInfo.gender === "MALE" ? "公蟹" : "母蟹"}`}
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50">
            <div className="text-muted-foreground text-[11px] flex items-center gap-1">
              <Calendar className="size-3" />
              约定发货日 / 状态
            </div>
            <div className="font-bold text-foreground text-sm mt-0.5 flex items-center gap-1.5">
              <span>{new Date(orderInfo.deliveryDate).toLocaleDateString("zh-CN")}</span>
              <Badge
                variant="secondary"
                className={`text-[10px] py-0 px-1.5 font-normal ${
                  orderInfo.status === "SHIPPED"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-amber-500/10 text-amber-600"
                }`}
              >
                {orderInfo.status === "SHIPPED" ? "已发货" : "待发货"}
              </Badge>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50">
            <div className="text-muted-foreground text-[11px] flex items-center gap-1">
              <Truck className="size-3" />
              订购数量 / 关联出库
            </div>
            <div className="font-bold text-foreground text-sm mt-0.5 font-mono">
              <span className="text-primary">{orderInfo.count} 只</span>
              {orderInfo.outboundOrderCode && (
                <span className="text-xs text-muted-foreground ml-1.5">
                  ({orderInfo.outboundOrderCode})
                </span>
              )}
            </div>
          </div>
        </div>
      ) : outboundInfo ? (
        /* 2. 出库单视角信息卡 */
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50">
            <div className="text-muted-foreground text-[11px] flex items-center gap-1">
              <FileText className="size-3" />
              出库类型
            </div>
            <div className="font-bold text-foreground text-sm mt-0.5">
              {outboundInfo.type === "STORE_ORDER" ? "门店订单配发" : "蟹卡统一提货出库"}
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50">
            <div className="text-muted-foreground text-[11px] flex items-center gap-1">
              <Store className="size-3" />
              发货去向
            </div>
            <div className="font-bold text-foreground text-sm truncate mt-0.5" title={outboundInfo.storeName}>
              {outboundInfo.storeName}
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50">
            <div className="text-muted-foreground text-[11px] flex items-center gap-1">
              <Truck className="size-3" />
              出库总数 / 物流
            </div>
            <div className="font-bold text-foreground text-sm mt-0.5">
              <span className="text-emerald-600 dark:text-emerald-400">{outboundInfo.outboundCount.toLocaleString()} 只</span>
              <span className="text-[11px] text-muted-foreground ml-1 font-normal truncate">
                ({outboundInfo.logisticsNo || "门店自配"})
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-2.5 border border-border/50">
            <div className="text-muted-foreground text-[11px] flex items-center gap-1">
              <Calendar className="size-3" />
              申请与审核人
            </div>
            <div className="font-bold text-foreground text-xs mt-0.5 truncate">
              {outboundInfo.applicantName} 申请 · {outboundInfo.approverName || "待审"} 核准
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
