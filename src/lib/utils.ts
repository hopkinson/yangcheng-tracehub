import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }
) {
  if (!date) return "-";
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    ...options,
  }).format(d);
}

export function formatDate(
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }
) {
  return formatDateTime(date, options);
}

export function formatTime(
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }
) {
  return formatDateTime(date, options);
}

export function formatISODate(date: Date | string | number = new Date()): string {
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
}

export function formatISOMonth(date: Date | string | number = new Date()): string {
  return formatISODate(date).slice(0, 7);
}

export function getBeijingDateStr(date: Date = new Date()): string {
  return formatISODate(date).replace(/-/g, "");
}



