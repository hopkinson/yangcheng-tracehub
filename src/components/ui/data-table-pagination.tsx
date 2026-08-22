"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps {
  total: number;
  page?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  pageParam?: string;
  pageSizeParam?: string;
}

export function DataTablePagination({
  total,
  page = 1,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
  pageParam = "page",
  pageSizeParam = "pageSize",
}: DataTablePaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const updateQueryParams = (newPage: number, newPageSize?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(pageParam, String(newPage));
    if (newPageSize) {
      params.set(pageSizeParam, String(newPageSize));
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 border-t">
      <div className="text-xs text-muted-foreground">
        共 <span className="font-medium text-foreground">{total}</span> 条数据
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">每页显示</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              updateQueryParams(1, Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[95px] text-xs">
              <SelectValue placeholder={String(pageSize)} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)} className="text-xs">
                  {size} 条/页
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-center text-xs font-medium whitespace-nowrap">
          第 {currentPage} / {totalPages} 页
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-xs"
            className="size-8"
            onClick={() => updateQueryParams(1)}
            disabled={currentPage <= 1}
            title="第一页"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            className="size-8"
            onClick={() => updateQueryParams(currentPage - 1)}
            disabled={currentPage <= 1}
            title="上一页"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            className="size-8"
            onClick={() => updateQueryParams(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="下一页"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            className="size-8"
            onClick={() => updateQueryParams(totalPages)}
            disabled={currentPage >= totalPages}
            title="最后一页"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
