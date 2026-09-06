"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PoolFilterSelect({
  pools,
  selectedPool,
}: {
  pools: { id: string; code: string }[];
  selectedPool?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleValueChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    val && val !== "ALL" ? params.set("pool", val) : params.delete("pool");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-muted-foreground font-medium shrink-0 whitespace-nowrap">
        关联池:
      </span>
      <Select value={selectedPool || "ALL"} onValueChange={handleValueChange}>
        <SelectTrigger className="h-7 w-[160px] text-xs font-mono bg-background">
          <SelectValue placeholder="全部暂养池" />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="ALL" className="text-xs">
            全部暂养池 ({pools.length} 口)
          </SelectItem>
          {pools.map((p) => (
            <SelectItem key={p.id} value={p.code} className="text-xs font-mono">
              {p.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
