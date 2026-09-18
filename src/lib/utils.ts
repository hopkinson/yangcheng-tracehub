import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 将任意合法日期转为北京时间 (Asia/Shanghai, UTC+8) 的标准字符串
 * 采用 sv-SE 格式保证输出恒为 YYYY-MM-DD HH:mm:ss，无 hydration 偏差且完全遵循中国国标与 ISO 破折号规范
 */
export function getBeijingTimeString(
  date: Date | string | number | null | undefined
): string | null {
  if (!date) return null;
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" });
}

/**
 * 标准日期时间：YYYY-MM-DD HH:mm (例如 2026-09-21 08:30)
 */
export function formatDateTime(
  date: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (options) {
    if (!date) return "-";
    const d = typeof date === "object" ? date : new Date(date);
    if (isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      ...options,
    }).format(d);
  }
  const s = getBeijingTimeString(date);
  return s ? s.slice(0, 16) : "-";
}

/**
 * 标准日期：YYYY-MM-DD (例如 2026-09-21)
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (options) {
    return formatDateTime(date, options);
  }
  const s = getBeijingTimeString(date);
  return s ? s.slice(0, 10) : "-";
}

/**
 * 紧凑短日期时间：MM-DD HH:mm (例如 09-21 08:30)，适用于高密度列表和日志流水
 */
export function formatShortDateTime(
  date: Date | string | number | null | undefined
): string {
  const s = getBeijingTimeString(date);
  return s ? s.slice(5, 16) : "-";
}

/**
 * 仅时间：HH:mm (例如 08:30)
 */
export function formatTime(
  date: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (options) {
    return formatDateTime(date, options);
  }
  const s = getBeijingTimeString(date);
  return s ? s.slice(11, 16) : "-";
}

/**
 * 完整时间戳：YYYY-MM-DD HH:mm:ss (例如 2026-09-21 08:30:00)
 */
export function formatFullDateTime(
  date: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (options) {
    return formatDateTime(date, options);
  }
  const s = getBeijingTimeString(date);
  return s || "-";
}

/**
 * ISO 日期：YYYY-MM-DD (空或默认当前北京时间)
 */
export function formatISODate(date: Date | string | number = new Date()): string {
  const s = getBeijingTimeString(date);
  return s ? s.slice(0, 10) : "";
}

/**
 * ISO 月份：YYYY-MM (例如 2026-09)
 */
export function formatISOMonth(date: Date | string | number = new Date()): string {
  const s = getBeijingTimeString(date);
  return s ? s.slice(0, 7) : "";
}

/**
 * 获取北京时间紧凑日期串：YYYYMMDD
 */
export function getBeijingDateStr(date: Date = new Date()): string {
  return formatISODate(date).replace(/-/g, "");
}

/**
 * 获取北京时间年份 (数字)
 */
export function getBeijingYear(date: Date | string | number = new Date()): number {
  const s = getBeijingTimeString(date);
  return s ? parseInt(s.slice(0, 4), 10) : new Date().getFullYear();
}

/**
 * 获取统一的文件安全预览 URL
 * - 本地文件或云端文件：统一通过 /api/files/preview 提供同源安全渲染代理，解决跨域、私有鉴权与 OSS 强制下载问题
 */
export function getPreviewFileUrl(rawUrl?: string | null, fileName?: string): string {
  if (!rawUrl || rawUrl.startsWith("data:")) return rawUrl || "";
  return `/api/files/preview?${new URLSearchParams({ url: rawUrl, ...(fileName && { name: fileName }) })}`;
}

/**
 * 将前端输入的本地日期时间字符串解析为确定性的北京时间 Date 对象 (UTC+8)
 * - 若已带有时区标识 (如 'Z' 或 '+08:00' 等)，直接解析
 * - 若无时区标识 (如 '2026-09-18T16:09' 或 '2026-09-18 16:09')，自动按 UTC+8 解析，
 *   避免在系统时区为 UTC 的 Linux/生产服务器上被误当成 UTC 导致 +8 小时偏差
 */
export function parseBeijingDateTime(value?: string | Date | null): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const trimmed = value.trim();
  if (!trimmed) return new Date();
  if (trimmed.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(trimmed)) {
    return new Date(trimmed);
  }
  const normalized = trimmed.replace(" ", "T");
  const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
  return new Date(`${withSeconds}+08:00`);
}

/**
 * 将 YYYY-MM-DD 解析为对应北京时间的当日起始与截止 Date (无论服务端系统时区是 UTC 还是本地时区)
 * start: YYYY-MM-DDT00:00:00.000+08:00 (北京时间当天 00:00:00)
 * end:   YYYY-MM-DDT23:59:59.999+08:00 (北京时间当天 23:59:59.999)
 */
export function getBeijingDayRange(dateStr: string): { gte: Date; lte: Date } {
  const clean = dateStr.trim();
  return {
    gte: new Date(`${clean}T00:00:00.000+08:00`),
    lte: new Date(`${clean}T23:59:59.999+08:00`),
  };
}

