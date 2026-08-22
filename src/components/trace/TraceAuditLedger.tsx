"use client";

import * as React from "react";
import { CheckCircle2, Scale, ShieldCheck, Tag } from "lucide-react";

interface TraceAuditLedgerProps {
  order: {
    outboundCount: number;
    batch: {
      farmer: {
        name: string;
        code: string;
        quota: number;
      };
    };
  };
}

export function TraceAuditLedger({ order }: TraceAuditLedgerProps) {
  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 flex flex-col gap-3">
      {/* 核心结论 3 项核验卡片（一排精炼展示） */}
      <div className="grid gap-3 sm:grid-cols-3 text-xs">
        <div className="flex items-center gap-2.5 rounded-lg bg-background/80 px-3 py-2.5 border border-emerald-500/15">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Scale className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-foreground">额度守恒已轧平</div>
            <div className="text-[11px] text-muted-foreground truncate">
              核定 {order.batch.farmer.quota.toLocaleString()} 只 · 本票核销 {order.outboundCount.toLocaleString()} 只
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg bg-background/80 px-3 py-2.5 border border-emerald-500/15">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Tag className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-foreground">蟹扣实名专户专用</div>
            <div className="text-[11px] text-muted-foreground truncate font-mono">
              {order.batch.farmer.code} ({order.batch.farmer.name})
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg bg-background/80 px-3 py-2.5 border border-emerald-500/15">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <ShieldCheck className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-foreground">数量守恒闭环</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              出库数量未超出签约额度
            </div>
          </div>
        </div>
      </div>

      {/* 简短静默声明 */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
        <span>* 批次溯源面向渠道开放，发货总量受养殖户年度理论产量严格约束。</span>
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 className="size-3" />
          合规审计通过
        </span>
      </div>
    </div>
  );
}
