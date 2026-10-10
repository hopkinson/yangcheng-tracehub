"use client";

import { useFormContext } from "react-hook-form";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { formatISODate } from "@/lib/utils";
import type { TagClaimFormValues } from "@/lib/validations/schemas";

export function TagClaimTimeField() {
  const { control } = useFormContext<Pick<TagClaimFormValues, "claimDate">>();

  return (
    <FormField
      control={control}
      name="claimDate"
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel>申领时间（北京时间）</FormLabel>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button type="button" variant="outline" className="flex-1 justify-start font-normal">
                    <CalendarIcon className="size-4" />
                    {field.value?.slice(0, 10) || "选择日期"}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  required
                  selected={field.value ? parseISO(field.value.slice(0, 10)) : undefined}
                  onSelect={(date) => field.onChange(`${format(date, "yyyy-MM-dd")}T${field.value?.slice(11) || "00:00"}`)}
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              step={60}
              className="w-32"
              aria-label="申领时分（北京时间）"
              aria-invalid={fieldState.invalid}
              value={field.value?.slice(11) || ""}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(`${field.value?.slice(0, 10) || formatISODate()}T${event.target.value}`)}
            />
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
