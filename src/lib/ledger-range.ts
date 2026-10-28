import { getBeijingDayRange, formatDate } from "./utils";

export class LedgerRangeError extends Error {}

function shiftMonths(dateStr: string, count: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + count, 1));
  const maxDays = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, maxDays));
  return target.toISOString().slice(0, 10);
}

export function getLedgerRange(params: { start?: string; end?: string; date?: string }, today = formatDate(new Date())) {
  const defaultStart = shiftMonths(today, -1);
  if (Boolean(params.start?.trim()) !== Boolean(params.end?.trim())) throw new LedgerRangeError("请选择完整的起止日期");
  const legacyDate = params.date?.trim();
  const start = params.start?.trim() || legacyDate || defaultStart;
  const end = params.end?.trim() || legacyDate || today;
  for (const value of [start, end]) {
    const date = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new LedgerRangeError("请选择有效的起止日期");
    }
  }
  if (start > end) throw new LedgerRangeError("开始日期不能晚于结束日期");
  const maxEnd = shiftMonths(start, 3);
  if (end > maxEnd) throw new LedgerRangeError("单次查询最多三个月，请缩小日期范围");
  return { start, end, filter: { gte: getBeijingDayRange(start).gte, lte: getBeijingDayRange(end).lte } };
}
