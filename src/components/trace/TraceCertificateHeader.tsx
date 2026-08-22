"use client";

import * as React from "react";
import { ShieldCheck, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PrintTraceButton } from "@/components/trace/PrintTraceButton";

interface TraceCertificateHeaderProps {
  order: {
    code: string;
    outboundCount: number;
    store: {
      name: string;
    };
    channel: {
      name: string;
    };
    batch: {
      code: string;
      gender: string;
      weightTier: string;
      farmer: {
        name: string;
        code: string;
      };
    };
  };
}

export function TraceCertificateHeader({ order }: TraceCertificateHeaderProps) {
  return (
    <div className="rounded-xl border bg-card p-4 md:p-5 shadow-xs flex flex-col gap-4">
      {/* 头部标题与状态 */}
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-foreground">{order.code}</span>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs py-0">
                溯源链路已验真
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              批次: <span className="font-mono">{order.batch.code}</span> · 渠道: {order.channel.name}
            </div>
          </div>
        </div>

        <div className="print:hidden">
          <PrintTraceButton />
        </div>
      </div>

      {/* 4 项核心数据（无冗余描述） */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-lg bg-muted/40 p-2.5">
          <div className="text-muted-foreground text-[11px]">规格</div>
          <div className="font-bold text-foreground text-sm">
            {order.batch.weightTier} · {order.batch.gender === "MALE" ? "公蟹" : "母蟹"}
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-2.5">
          <div className="text-muted-foreground text-[11px]">发货数量</div>
          <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
            {order.outboundCount.toLocaleString()} 只
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-2.5">
          <div className="text-muted-foreground text-[11px]">接收门店</div>
          <div className="font-bold text-foreground text-sm truncate" title={order.store.name}>
            {order.store.name}
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-2.5">
          <div className="text-muted-foreground text-[11px]">签约养殖户 / 蟹扣</div>
          <div className="font-bold text-foreground text-sm truncate">
            {order.batch.farmer.name} <span className="font-mono text-xs text-muted-foreground">({order.batch.farmer.code})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
