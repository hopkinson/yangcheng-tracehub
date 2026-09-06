"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { zhCN } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const navBtnClass =
  "size-7 p-0 pointer-events-auto bg-background/80 hover:bg-accent text-muted-foreground hover:text-foreground shadow-2xs border-border/70";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale = zhCN,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={locale}
      showOutsideDays={showOutsideDays}
      className={cn("p-3 select-none", className)}
      classNames={{
        root: "relative",
        months: "relative flex flex-col gap-3",
        month: "flex flex-col gap-2",
        month_caption: "flex items-center justify-center h-8 font-medium text-sm text-foreground",
        caption_label: "text-sm font-semibold tracking-tight text-foreground",
        month_grid: "w-full border-collapse",
        weekdays: "border-b border-border/50",
        weekday: "text-muted-foreground text-xs font-normal text-center w-8 h-8 select-none align-middle",
        weeks: "space-y-1 pt-1",
        week: "h-8",
        day: "p-0.5 text-center align-middle relative",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Nav: ({ onPreviousClick, onNextClick, previousMonth, nextMonth }) => (
          <div className="flex items-center justify-between absolute top-0 inset-x-0 h-8 pointer-events-none z-10 px-0.5">
            <Button
              variant="outline"
              size="icon-xs"
              className={navBtnClass}
              disabled={!previousMonth}
              onClick={onPreviousClick}
              type="button"
              aria-label="上一月"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              className={navBtnClass}
              disabled={!nextMonth}
              onClick={onNextClick}
              type="button"
              aria-label="下一月"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        ),
        DayButton: ({ day, modifiers, className, ...buttonProps }) => {
          const { selected, today, outside, disabled } = modifiers;
          const stateClass = selected
            ? "bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary/90 hover:text-primary-foreground"
            : today
            ? "bg-accent/70 font-semibold text-foreground hover:bg-accent hover:text-accent-foreground border border-border/70"
            : outside
            ? "text-muted-foreground/35 hover:bg-accent/30 hover:text-muted-foreground"
            : disabled
            ? "text-muted-foreground/20 cursor-not-allowed pointer-events-none"
            : "text-foreground hover:bg-accent hover:text-accent-foreground active:scale-95";

          return (
            <button
              type="button"
              className={cn(
                "size-8 mx-auto text-xs font-normal rounded-md transition-all inline-flex items-center justify-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                stateClass,
                className
              )}
              {...buttonProps}
            >
              {day.date.getDate()}
            </button>
          );
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
