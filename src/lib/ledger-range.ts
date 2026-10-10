import { subMonths, addMonths, parseISO, format } from "date-fns";
import { getBeijingDayRange, formatDate } from "./utils";

export class LedgerRangeError extends Error {}

export function getLedgerRange(params: { start?: string; end?: string; date?: string }, today = formatDate(new Date())) {
  const defaultStart = format(subMonths(new Date(`${today}T12:00:00`), 1), "yyyy-MM-dd");
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
  const maxEnd = format(addMonths(parseISO(start), 3), "yyyy-MM-dd");
  if (end > maxEnd) throw new LedgerRangeError("单次查询最多三个月，请缩小日期范围");
  return { start, end, filter: { gte: getBeijingDayRange(start).gte, lte: getBeijingDayRange(end).lte } };
}
