"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function BatchFilterSelect({
  batches,
  selectedBatch,
}: {
  batches: { id: string; code: string; farmer?: { name: string } | null }[];
  selectedBatch?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleValueChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    value !== "ALL" ? params.set("batch", value) : params.delete("batch");
    params.delete("page");
    router.push(`${pathname}?${params}`);
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-muted-foreground font-medium shrink-0 whitespace-nowrap">关联批次:</span>
      <Select value={selectedBatch || "ALL"} onValueChange={handleValueChange}>
        <SelectTrigger className="h-7 w-[190px] text-xs font-mono bg-background">
          <SelectValue placeholder="全部原料批次" />
        </SelectTrigger>
        <SelectContent align="start" className="max-h-64">
          <SelectItem value="ALL" className="text-xs">全部原料批次 ({batches.length} 批)</SelectItem>
          {batches.map((batch) => (
            <SelectItem key={batch.id} value={batch.code} className="text-xs font-mono">
              <span className="font-semibold">{batch.code}</span>
              {batch.farmer?.name && <span className="text-muted-foreground ml-1">({batch.farmer.name})</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
