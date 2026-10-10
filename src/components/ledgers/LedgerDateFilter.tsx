"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { parseISO, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDate } from "@/lib/utils";
import { getLedgerRange } from "@/lib/ledger-range";
import { toast } from "sonner";

function LedgerRangeFilter({ startDate, endDate }: { startDate: string; endDate: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [range, setRange] = React.useState<DateRange | undefined>({ from: parseISO(startDate), to: parseISO(endDate) });
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { setRange({ from: parseISO(startDate), to: parseISO(endDate) }); }, [startDate, endDate]);

  function apply(start: string, end: string) {
    try { getLedgerRange({ start, end }); }
    catch (error) { toast.error((error as Error).message); return; }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("date");
    for (const key of [...params.keys()]) if (/^l\d+Page$/.test(key)) params.delete(key);
    params.set("start", start);
    params.set("end", end);
    router.push(`${pathname}?${params}`, { scroll: false });
    setOpen(false);
  }

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button variant="outline" className="h-8 gap-1.5 text-xs font-normal">
        <CalendarIcon className="size-3.5 text-muted-foreground" />{startDate} 至 {endDate}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="end">
      <Calendar mode="range" defaultMonth={parseISO(endDate)} selected={range} onSelect={setRange} />
      <div className="flex flex-col gap-2 border-t p-3">
        <p className="text-xs text-muted-foreground">{range?.from ? format(range.from, "yyyy-MM-dd") : "开始日期"} 至 {range?.to ? format(range.to, "yyyy-MM-dd") : "结束日期"}</p>
        <p className="text-xs text-muted-foreground">单次最多三个月，可查询历史日期</p>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => { const value = getLedgerRange({}); apply(value.start, value.end); }}>最近一个月</Button>
          <Button size="sm" disabled={!range?.from || !range?.to} onClick={() => { if (range?.from && range.to) apply(format(range.from, "yyyy-MM-dd"), format(range.to, "yyyy-MM-dd")); }}>查询</Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>;
}

function SingleDateFilter({ selectedDate }: { selectedDate?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [date, setDate] = React.useState<Date | undefined>(
    selectedDate ? parseISO(selectedDate) : undefined
  );
  const [open, setOpen] = React.useState(false);

  const applyDate = (newDate: Date | undefined) => {
    setDate(newDate);
    const params = new URLSearchParams(searchParams.toString());
    if (newDate) {
      params.set("date", formatDate(newDate));
    } else {
      params.delete("date");
    }
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  };

  const handleClear = () => {
    applyDate(undefined);
  };

  const handleToday = () => {
    applyDate(new Date());
  };

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[155px] justify-start text-left font-normal text-xs h-7 px-2.5 gap-1.5",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{date ? formatDate(date) : "指定日期查询"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => applyDate(d)}
          />
          <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 bg-muted/20">
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2 hover:bg-muted font-medium text-foreground" onClick={handleToday}>
              选择今天
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground" onClick={handleClear}>
              重置 (查全量)
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {date && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5 mr-1" />
          清除
        </Button>
      )}
    </div>
  );
}

// 其他业务页仍使用单日筛选，范围查询只用于合规台账。
export function LedgerDateFilter(props: { startDate: string; endDate: string } | { selectedDate?: string }) {
  return "startDate" in props ? <LedgerRangeFilter {...props} /> : <SingleDateFilter {...props} />;
}
