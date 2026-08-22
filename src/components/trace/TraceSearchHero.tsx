"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TraceSearchHeroProps {
  initialQuery?: string;
  isChannelViewer?: boolean;
  channelName?: string;
}

const SAMPLE_QUERIES = ["CK-20260901-001", "PC-20260901-001"];

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
    <div className="rounded-xl border bg-card p-4 md:p-5 shadow-xs print:hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">
            全链路追溯查询
          </h2>
          {isChannelViewer && channelName && (
            <span className="text-xs text-muted-foreground">
              当前渠道: <strong className="text-foreground">{channelName}</strong>
            </span>
          )}
        </div>

        {/* 紧凑搜索栏 */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入出库单号 (CK-...) 或原料批次号 (PC-...)"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-8 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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

        {/* 示例标签 */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">快捷示例:</span>
          {SAMPLE_QUERIES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => handleSampleClick(code)}
              className="font-mono rounded border bg-muted/50 px-2 py-0.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
            >
              {code}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
