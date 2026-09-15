"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettleTagClaimDialog } from "@/components/forms/SettleTagClaimDialog";
import { formatDate } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

interface UnbalancedClaimsBannerProps {
  claims: any[];
  isWarehouseOrAdmin: boolean;
  currentUserId: string;
}

export function UnbalancedClaimsBanner({
  claims,
  isWarehouseOrAdmin,
  currentUserId,
}: UnbalancedClaimsBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!claims || claims.length === 0) return null;

  const totalDiff = claims.reduce((sum, c) => {
    const accounted = (c.boundCount || 0) + (c.returnedCount || 0) + (c.scrappedCount || 0);
    return sum + Math.max(0, c.claimCount - accounted);
  }, 0);

  const displayedList = isExpanded ? claims : claims.slice(0, 3);

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-4 shadow-xs transition-all">
      {/* 头部：指标摘要 + 控制按钮 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start sm:items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-sm">
            ⚠️
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                蟹扣日结待轧平预警
              </h3>
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[11px]">
                {claims.length} 笔未轧平 (缺口 {totalDiff} 只)
              </Badge>
            </div>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
              系统硬约束：若前日存在未轧平领扣记录，次日将阻断该养殖户的新领扣申请。
            </p>
          </div>
        </div>

        {claims.length > 3 && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 self-end sm:self-center bg-background/80 hover:bg-background cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <span>收起</span>
                <ChevronUp className="size-3.5" />
              </>
            ) : (
              <>
                <span>展开待办 ({claims.length})</span>
                <ChevronDown className="size-3.5" />
              </>
            )}
          </Button>
        )}
      </div>

      {/* 卡片列表区：收起时仅 3 条，展开时限制最大高度滚动 */}
      <div
        className={`mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 ${
          isExpanded ? "max-h-[360px] overflow-y-auto pr-1" : ""
        }`}
      >
        {displayedList.map((claim) => {
          const accounted = (claim.boundCount || 0) + (claim.returnedCount || 0) + (claim.scrappedCount || 0);
          const diff = claim.claimCount - accounted;
          return (
            <div
              key={claim.id}
              className="flex items-center justify-between rounded-lg p-2.5 border border-amber-500/30 hover:border-amber-500/60 text-xs bg-background/90"
            >
              <div className="flex flex-col min-w-0 pr-2">
                <div className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                  <span className="truncate">{claim.farmer?.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    ({formatDate(claim.claimDate)})
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>领: <strong className="font-mono text-foreground">{claim.claimCount}</strong></span>
                  <span>销: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{accounted}</strong></span>
                  <span>
                    差额:{" "}
                    <strong className={`font-mono ${diff === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive font-bold"}`}>
                      {diff} 只
                    </strong>
                  </span>
                </div>
              </div>

              {isWarehouseOrAdmin && (
                <div className="shrink-0">
                  <SettleTagClaimDialog claim={claim} userId={currentUserId} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
