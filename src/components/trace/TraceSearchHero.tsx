"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TraceSearchHeroProps {
  initialQuery?: string;
  isChannelViewer?: boolean;
  channelName?: string;
}

const SAMPLE_QUERIES = [
  { label: "门店订单", code: "SM20260920001" },
  { label: "蟹卡提货", code: "KK20260920055" },
  { label: "顺丰直发", code: "KK20260919018" },
  { label: "出库批次", code: "CK2026092101" },
];

export function TraceSearchHero({
  initialQuery = "",
  isChannelViewer = false,
  channelName = "",
}: TraceSearchHeroProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState(initialQuery);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      router.push("/trace");
    } else {
      router.push(`/trace?query=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSampleClick = (code: string) => {
    setQuery(code);
    router.push(`/trace?query=${encodeURIComponent(code)}`);
  };

  return (
    <div className="rounded-xl border bg-card p-4 md:p-5 shadow-xs print:hidden flex flex-col gap-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-foreground">
            全链路溯源查询
          </h2>
          <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            双入口直达
          </span>
        </div>
        {isChannelViewer && channelName && (
          <span className="text-xs text-muted-foreground">
            当前渠道: <strong className="text-foreground">{channelName}</strong>
          </span>
        )}
      </div>

      {/* 搜索栏 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="支持输入订单号 (SO/SM/KK...) 或出库批次号 (CK...)"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-8 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Button type="submit" size="sm" className="h-10 px-4 font-medium gap-1.5 cursor-pointer">
          <span>查询</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </form>

      {/* 快捷示例 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground flex items-center gap-1 shrink-0">
          <Sparkles className="size-3 text-primary" />
          示例单号一键填充:
        </span>
        {SAMPLE_QUERIES.map((item) => (
          <button
            key={item.code}
            type="button"
            onClick={() => handleSampleClick(item.code)}
            className="rounded border bg-muted/60 px-2 py-0.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors cursor-pointer flex items-center gap-1 font-mono"
          >
            <span className="text-[10px] text-muted-foreground font-sans">{item.label}:</span>
            {item.code}
          </button>
        ))}
      </div>

      {/* 边界声明 Banner */}
      <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="leading-tight">
          <strong>系统边界声明：</strong>
          <span>不定位单只 · 不承担防伪。本系统为数量闭环管控与合规证明系统，证明发出的带扣蟹总量 ≤ 签约养殖户的理论核定产量。</span>
        </div>
      </div>
    </div>
  );
}
