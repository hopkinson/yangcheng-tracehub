"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

  const handleValueChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    value !== "ALL" ? params.set("pool", value) : params.delete("pool");
    params.delete("page");
    router.push(`${pathname}?${params}`);
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-muted-foreground font-medium shrink-0 whitespace-nowrap">关联池:</span>
      <Select value={selectedPool || "ALL"} onValueChange={handleValueChange}>
        <SelectTrigger className="h-7 w-[160px] text-xs font-mono bg-background">
          <SelectValue placeholder="全部暂养池" />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="ALL" className="text-xs">全部暂养池 ({pools.length} 口)</SelectItem>
          {pools.map((pool) => <SelectItem key={pool.id} value={pool.code} className="text-xs font-mono">{pool.code}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
