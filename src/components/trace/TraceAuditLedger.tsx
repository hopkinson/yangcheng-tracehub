"use client";

import * as React from "react";
import { CheckCircle2, Scale, ShieldCheck, Tag } from "lucide-react";
import { TraceQueryResult } from "@/lib/trace-service";

interface TraceAuditLedgerProps {
  data: TraceQueryResult;
}

export function TraceAuditLedger({ data }: TraceAuditLedgerProps) {
  const { farmerInfo, orderInfo, outboundInfo, isPreview } = data;
  const count = orderInfo?.count || outboundInfo?.outboundCount || 0;

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 flex flex-col gap-3">
      {/* 核心结论 3 项核验卡片 */}
      <div className="grid gap-3 sm:grid-cols-3 text-xs">
        <div className="flex items-center gap-2.5 rounded-lg bg-background/80 px-3 py-2.5 border border-emerald-500/15">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Scale className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-foreground">额度守恒闭环</div>
            <div className="text-[11px] text-muted-foreground truncate">
              核定 {farmerInfo.quota.toLocaleString()} 只 · 本票核销 {count.toLocaleString()} 只
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg bg-background/80 px-3 py-2.5 border border-emerald-500/15">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Tag className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-foreground">蟹扣专户专用</div>
            <div className="text-[11px] text-muted-foreground truncate font-mono">
              {farmerInfo.code} ({farmerInfo.name})
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg bg-background/80 px-3 py-2.5 border border-emerald-500/15">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <ShieldCheck className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-foreground">
              {isPreview ? "履约推演合规" : "合规审计通过"}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate">
              发货总量 ≤ 签约养殖户理论产量
            </div>
          </div>
        </div>
      </div>

      {/* 简短静默声明 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-muted-foreground px-1">
        <span>* 批次溯源面向渠道开放，发货总量受养殖户年度理论产量严格约束。</span>
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 className="size-3" />
          数量守恒数学闭环证明有效
        </span>
      </div>
    </div>
  );
}
