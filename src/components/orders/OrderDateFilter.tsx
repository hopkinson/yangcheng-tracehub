"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function OrderDateFilter({
  currentDate,
  todayStr,
  tomorrowStr,
  availableDates = [],
}: {
  currentDate: string;
  todayStr: string;
  tomorrowStr: string;
  availableDates?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = React.useState(false);

  const selectedDateObj =
    currentDate && currentDate !== "all" ? new Date(`${currentDate}T00:00:00`) : undefined;

  const applyDate = (dateStr: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!dateStr || dateStr === "all") {
      params.delete("date");
    } else {
      params.set("date", dateStr);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setOpen(false);
  };

  // 快捷展示订单中存在的其他日期（除今日、次日外，最多取 3 个）
  const otherDates = availableDates.filter((d) => d !== todayStr && d !== tomorrowStr).slice(0, 3);
  const isCustomDate = !["all", todayStr, tomorrowStr, ...otherDates].includes(currentDate);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        variant={currentDate === "all" ? "default" : "outline"}
        size="sm"
        className="h-7 text-xs px-2.5"
        onClick={() => applyDate("all")}
      >
        全部
      </Button>
      <Button
        variant={currentDate === todayStr ? "default" : "outline"}
        size="sm"
        className="h-7 text-xs px-2.5"
        onClick={() => applyDate(todayStr)}
      >
        当日 ({todayStr.slice(5)})
      </Button>
      <Button
        variant={currentDate === tomorrowStr ? "default" : "outline"}
        size="sm"
        className="h-7 text-xs px-2.5"
        onClick={() => applyDate(tomorrowStr)}
      >
        次日 ({tomorrowStr.slice(5)})
      </Button>

      {otherDates.map((d) => (
        <Button
          key={d}
          variant={currentDate === d ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs px-2.5"
          onClick={() => applyDate(d)}
        >
          {d.slice(5)}
        </Button>
      ))}

      {/* shadcn Popover + Calendar */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={isCustomDate ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-7 text-xs px-2.5 gap-1.5 font-normal",
              !selectedDateObj && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="size-3.5 text-muted-foreground" />
            <span>
              {isCustomDate && selectedDateObj
                ? format(selectedDateObj, "yyyy-MM-dd")
                : "选日历"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDateObj}
            onSelect={(date) => date && applyDate(format(date, "yyyy-MM-dd"))}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
