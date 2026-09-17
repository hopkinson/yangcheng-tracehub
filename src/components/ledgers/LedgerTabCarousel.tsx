"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface LedgerTabItem {
  key: string;
  no: number;
  label: string;
  count: number;
}

interface LedgerTabCarouselProps {
  ledgers: LedgerTabItem[];
  className?: string;
}

export function LedgerTabCarousel({
  ledgers,
  className,
}: LedgerTabCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    checkScroll();

    const observer = new ResizeObserver(() => {
      checkScroll();
    });
    observer.observe(el);

    const activeEl = el.querySelector<HTMLElement>("[data-state='active']");
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
    }

    return () => observer.disconnect();
  }, [checkScroll]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(220, Math.floor(el.clientWidth * 0.6));
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div className={cn("relative flex items-center gap-2 w-full", className)}>
      {/* 左侧轮播箭头 */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => scroll("left")}
        disabled={!canScrollLeft}
        className="size-9 shrink-0 rounded-lg border-border/60 bg-background/80 shadow-2xs hover:bg-muted active:scale-95 transition-all disabled:opacity-20 disabled:pointer-events-none"
        aria-label="向前滑动台账"
      >
        <ChevronLeft className="size-4 text-foreground" />
      </Button>

      {/* 滚动视口包装器 */}
      <div className="relative flex-1 min-w-0 overflow-hidden rounded-xl border border-border/60 bg-muted/40 p-1.5 shadow-2xs">
        {/* 左边缘渐变羽化遮罩 */}
        <div
          className={cn(
            "pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-r from-background/90 via-background/40 to-transparent transition-opacity duration-200",
            canScrollLeft ? "opacity-100" : "opacity-0"
          )}
        />

        {/* 核心横向滚动容器：彻底隐藏滚动条 */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden scroll-smooth px-1"
        >
          <TabsList className="inline-flex h-auto w-max group-data-[orientation=horizontal]/tabs:h-auto items-center gap-1.5 bg-transparent p-0">
            {ledgers.map((ledger) => {
              const noStr = String(ledger.no).padStart(2, "0");
              const name = ledger.label.replace(/^\d+\s*/, "");

              return (
                <TabsTrigger
                  key={ledger.key}
                  value={ledger.key}
                  onClick={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "nearest" })}
                  className={cn(
                    "group relative flex h-9 shrink-0 items-center gap-2 rounded-lg border border-transparent px-3 py-1 text-left text-xs font-normal transition-all duration-150 whitespace-nowrap",
                    "text-muted-foreground hover:border-border/50 hover:bg-background/80 hover:text-foreground active:scale-[0.985]",
                    "data-[state=active]:border-border/80 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted/80 font-mono text-[10px] font-semibold text-muted-foreground/80 transition-colors group-hover:text-foreground group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground">
                      {noStr}
                    </span>
                    <span className="text-xs font-medium tracking-tight text-foreground/90">
                      {name}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition-colors",
                      ledger.count > 0
                        ? "bg-primary/10 font-semibold text-primary group-data-[state=active]:bg-primary/15 group-data-[state=active]:text-primary"
                        : "text-muted-foreground/40"
                    )}
                  >
                    {ledger.count}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* 右边缘渐变羽化遮罩 */}
        <div
          className={cn(
            "pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l from-background/90 via-background/40 to-transparent transition-opacity duration-200",
            canScrollRight ? "opacity-100" : "opacity-0"
          )}
        />
      </div>

      {/* 右侧轮播箭头 */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => scroll("right")}
        disabled={!canScrollRight}
        className="size-9 shrink-0 rounded-lg border-border/60 bg-background/80 shadow-2xs hover:bg-muted active:scale-95 transition-all disabled:opacity-20 disabled:pointer-events-none"
        aria-label="向后滑动台账"
      >
        <ChevronRight className="size-4 text-foreground" />
      </Button>
    </div>
  );
}
