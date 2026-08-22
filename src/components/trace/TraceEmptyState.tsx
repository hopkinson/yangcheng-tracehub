"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Scale,
  FileCheck2,
  GitFork,
  ArrowUpRight,
} from "lucide-react";

interface TraceEmptyStateProps {
  recentOrders?: Array<{
    code: string;
    storeName: string;
    channelName: string;
    outboundCount: number;
    batchCode: string;
    weightTier: string;
    gender: string;
    farmerName: string;
    createdAt: Date | string;
  }>;
}

const VERIFICATION_PILLARS = [
  { icon: ShieldCheck, title: "源头养殖绑定", sub: "养殖户与围网信息关联" },
  { icon: Scale, title: "数量守恒校验", sub: "出库总量 ≤ 签约额度" },
  { icon: FileCheck2, title: "质检监测报告", sub: "批次药残与产地证明" },
  { icon: GitFork, title: "全链路追溯", sub: "门店 ➔ 出库 ➔ 批次 ➔ 养殖户" },
];

export function TraceEmptyState({ recentOrders = [] }: TraceEmptyStateProps) {
  return (
    <div className="flex flex-col gap-6 py-2">
      {/* 4 核心要点简卡 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {VERIFICATION_PILLARS.map((p, idx) => {
          const Icon = p.icon;
          return (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-xs"
            >
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground truncate">{p.title}</div>
                <div className="text-[11px] text-muted-foreground truncate">{p.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 示范单据列表 */}
      {recentOrders.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-semibold text-muted-foreground px-1">
            可查溯源示范单据 (点击直接体验):
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {recentOrders.map((ord) => (
              <Link
                key={ord.code}
                href={`/trace?query=${encodeURIComponent(ord.code)}`}
                className="group flex items-center justify-between rounded-xl border bg-card p-3 transition-all hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary group-hover:underline">
                      {ord.code}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                      {ord.channelName}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {ord.storeName} · {ord.outboundCount}只 ({ord.gender === "MALE" ? "公" : "母"} {ord.weightTier}) · 养殖户: {ord.farmerName}
                  </div>
                </div>
                <div className="p-1.5 rounded-md bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0 ml-2">
                  <ArrowUpRight className="size-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
