"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDate } from "@/lib/utils";

export function OrderDateFilter({
  currentDate,
  todayStr,
  tomorrowStr,
}: {
  currentDate: string;
  todayStr: string;
  tomorrowStr: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = React.useState(false);

  const presets = [
    { label: `当日 (${todayStr.slice(5)})`, key: todayStr },
    { label: `次日 (${tomorrowStr.slice(5)})`, key: tomorrowStr },
    { label: "本周", key: "week" },
    { label: "本月", key: "month" },
    { label: "本年", key: "year" },
  ];
  const isCustomDate = currentDate !== "all" && presets.every((p) => p.key !== currentDate);

  const selectedDateObj =
    isCustomDate && currentDate ? new Date(`${currentDate}T00:00:00`) : undefined;

  const applyDate = (dateStr: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!dateStr || dateStr === "year") {
      params.delete("date");
    } else {
      params.set("date", dateStr);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map(({ label, key }) => (
        <Button
          key={key}
          variant={currentDate === key ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs px-2.5"
          onClick={() => applyDate(key)}
        >
          {label}
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
                ? formatDate(selectedDateObj)
                : "选日历"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDateObj}
            onSelect={(date) => date && applyDate(formatDate(date))}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
