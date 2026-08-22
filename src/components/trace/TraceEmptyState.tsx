"use client";

import * as React from "react";
import {
  ShieldCheck,
  Scale,
  FileCheck2,
  GitFork,
} from "lucide-react";

const VERIFICATION_PILLARS = [
  { icon: ShieldCheck, title: "源头养殖绑定", sub: "养殖户与围网信息关联" },
  { icon: Scale, title: "数量守恒校验", sub: "出库总量 ≤ 签约额度" },
  { icon: FileCheck2, title: "质检监测报告", sub: "批次药残与产地证明" },
  { icon: GitFork, title: "全链路追溯", sub: "门店 ➔ 出库 ➔ 批次 ➔ 养殖户" },
];

export function TraceEmptyState() {
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
    </div>
  );
}
