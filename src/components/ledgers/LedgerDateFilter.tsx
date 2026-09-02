"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function LedgerDateFilter({ selectedDate }: { selectedDate?: string }) {
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
      params.set("date", format(newDate, "yyyy-MM-dd"));
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
            <span className="truncate">{date ? format(date, "yyyy-MM-dd") : "指定日期查询"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => applyDate(d)}
          />
          <div className="flex items-center justify-between border-t p-2">
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleToday}>
              选择今天
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={handleClear}>
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
