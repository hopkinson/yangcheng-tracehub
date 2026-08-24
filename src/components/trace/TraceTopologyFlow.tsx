"use client";

import * as React from "react";
import {
  Building2,
  Truck,
  Waves,
  Layers,
  MapPin,
} from "lucide-react";
import { BatchReportViewDialog } from "@/components/batches/BatchReportViewDialog";
import { formatDate } from "@/lib/utils";

interface TraceTopologyFlowProps {
  order: {
    code: string;
    outboundCount: number;
    logisticsNo?: string | null;
    createdAt: Date | string;
    approvedAt?: Date | string | null;
    store: {
      name: string;
      code: string;
    };
    channel: {
      name: string;
    };
    batch: {
      code: string;
      gender: string;
      weightTier: string;
      inPoolCount: number;
      reportUrl?: string | null;
      reportName?: string | null;
      pool: {
        name: string;
        code: string;
      };
      farmer: {
        name: string;
        code: string;
        area: number;
        quota: number;
        farmType: string;
      };
      enclosure: {
        code: string;
      };
    };
  };
}

export function TraceTopologyFlow({ order }: TraceTopologyFlowProps) {
  const nodes = [
    {
      role: "1. 销售门店",
      icon: Building2,
      color: "border-amber-500/30 bg-amber-500/5",
      accent: "text-amber-600 dark:text-amber-400",
      main: order.store.name,
      sub: `编码: ${order.store.code} · ${order.channel.name}`,
    },
    {
      role: "2. 发运出库",
      icon: Truck,
      color: "border-blue-500/30 bg-blue-500/5",
      accent: "text-blue-600 dark:text-blue-400",
      main: `${order.outboundCount} 只`,
      sub: `物流: ${order.logisticsNo || "待生成"} · ${formatDate(order.approvedAt || order.createdAt)}`,
    },
    {
      role: "3. 暂养仓位",
      icon: Waves,
      color: "border-cyan-500/30 bg-cyan-500/5",
      accent: "text-cyan-600 dark:text-cyan-400",
      main: order.batch.pool.name,
      sub: `池号: ${order.batch.pool.code} (在池 ${order.batch.inPoolCount}只)`,
    },
    {
      role: "4. 原料批次",
      icon: Layers,
      color: "border-emerald-500/30 bg-emerald-500/5",
      accent: "text-emerald-600 dark:text-emerald-400",
      main: order.batch.code,
      sub: `${order.batch.weightTier} · ${order.batch.gender === "MALE" ? "公蟹" : "母蟹"}`,
      report: order.batch.reportUrl
        ? {
            name: order.batch.reportName || "检测报告",
            url: order.batch.reportUrl,
          }
        : null,
    },
    {
      role: "5. 源头湖区",
      icon: MapPin,
      color: "border-purple-500/30 bg-purple-500/5",
      accent: "text-purple-600 dark:text-purple-400",
      main: order.batch.farmer.name,
      sub: `蟹扣: ${order.batch.farmer.code} · 围网 ${order.batch.enclosure.code}`,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* 极简流向头部 */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="font-bold text-foreground">逆向追溯拓扑链</span>
      </div>

      {/* 5 节点极简卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {nodes.map((n) => {
          const Icon = n.icon;
          return (
            <div
              key={n.role}
              className={`rounded-xl border ${n.color} p-3.5 flex flex-col justify-between gap-2.5 shadow-xs`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Icon className={`size-3.5 ${n.accent}`} />
                  <span>{n.role}</span>
                </div>
                <div className="font-bold text-foreground text-xs leading-snug line-clamp-2" title={n.main}>
                  {n.main}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono leading-tight">
                  {n.sub}
                </div>
              </div>

              {n.report && (
                <div className="pt-1.5 border-t border-border/40">
                  <BatchReportViewDialog
                    batchCode={order.batch.code}
                    reportName={n.report.name}
                    reportUrl={n.report.url}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
