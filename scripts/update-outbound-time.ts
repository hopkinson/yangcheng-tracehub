import { basename, resolve } from "node:path";
import * as XLSX from "xlsx";
import { prisma } from "../src/lib/prisma";
import { parseBeijingDateTime, formatFullDateTime } from "../src/lib/utils";

export interface TimeUpdateItem {
  code: string;
  newOutboundTime: string | Date;
  sourceFile?: string;
  sourceRow?: number;
}

function validatedTime(value: string | Date): Date {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error("出库时间无效");
    return value;
  }
  const text = value.trim().replace("T", " ");
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(text)) {
    throw new Error(`出库时间必须为 YYYY-MM-DD HH:mm[:ss]：${value}`);
  }
  const date = parseBeijingDateTime(text);
  const expected = text.length === 16 ? `${text}:00` : text;
  if (!Number.isFinite(date.getTime()) || formatFullDateTime(date) !== expected) {
    throw new Error(`出库时间无效：${value}`);
  }
  return date;
}

export function readOutboundTimeItems(workbook: XLSX.WorkBook, sourceFile: string): TimeUpdateItem[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Excel 没有工作表");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "", blankrows: true });
  const headers = rows[0]?.map((value) => String(value).trim()) || [];
  const codeColumn = headers.indexOf("出库批次");
  const timeColumn = headers.indexOf("出库时间");
  if (codeColumn < 0 || timeColumn < 0) throw new Error("首行必须包含出库批次和出库时间");

  const items: TimeUpdateItem[] = [];
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    if (row.every((value) => value === "" || value == null)) continue;
    // 台账后半部分是规格矩阵，不能把矩阵中的数量当时间。
    if (row[0] === "成品出库规格矩阵" || (row.includes("出库批次") && !row.includes("出库时间"))) break;
    const code = String(row[codeColumn] ?? "").trim();
    let value = row[timeColumn];
    if (typeof value === "number") {
      const date = XLSX.SSF.parse_date_code(value, { date1904: !!workbook.Workbook?.WBProps?.date1904 });
      if (!date) throw new Error(`第 ${index + 1} 行出库时间无效`);
      // Excel 小数日可能表示成 11:44:59.999997；按秒舍入，避免错误截成 11:44。
      value = new Date(Date.UTC(date.y, date.m - 1, date.d, date.H, date.M, Math.round(date.S + date.u)))
        .toISOString().slice(0, 19).replace("T", " ");
    }
    if (typeof value !== "string") throw new Error(`第 ${index + 1} 行出库时间无效`);
    items.push({ code, newOutboundTime: validatedTime(value), sourceFile, sourceRow: index + 1 });
  }
  if (!items.length) throw new Error("Excel 中没有出库单数据");
  return items;
}

export async function updateOutboundTimes(
  items: TimeUpdateItem[],
  options: { apply?: boolean; operatorId?: string } = {},
) {
  if (!items.length) throw new Error("出库单列表不能为空");
  const seen = new Set<string>();
  const normalized = items.map((item) => {
    const code = item.code.trim();
    if (!/^CK-\d{8}-\d+$/.test(code)) throw new Error(`出库批次号无效：${code}`);
    if (seen.has(code)) throw new Error(`出库批次号重复：${code}`);
    seen.add(code);
    return { ...item, code, target: validatedTime(item.newOutboundTime) };
  });

  return prisma.$transaction(async (tx) => {
    if (options.apply) {
      if (!options.operatorId) throw new Error("执行修改必须提供 --operator 管理员用户 ID");
      const operator = await tx.user.findUnique({ where: { id: options.operatorId }, select: { role: true } });
      if (operator?.role !== "ADMIN") throw new Error("执行修改的操作人必须是有效管理员");
    }
    const orders = await tx.outboundOrder.findMany({
      where: { code: { in: [...seen] } },
      select: { id: true, code: true, outboundTime: true },
    });
    const byCode = new Map(orders.map((order) => [order.code, order]));
    const missing = normalized.filter((item) => !byCode.has(item.code));
    if (missing.length) throw new Error(`未找到出库批次，整批取消：${missing.map((item) => item.code).join("、")}`);
    const changes = normalized.filter((item) => byCode.get(item.code)!.outboundTime.getTime() !== item.target.getTime());

    if (options.apply) {
      for (const item of changes) {
        const order = byCode.get(item.code)!;
        await tx.outboundOrder.update({ where: { id: order.id }, data: { outboundTime: item.target } });
        await tx.auditLog.create({
          data: {
            operatorId: options.operatorId!,
            action: "UPDATE_OUTBOUND_TIME",
            entityType: "OUTBOUND_ORDER",
            entityId: order.id,
            details: JSON.stringify({
              orderCode: order.code,
              previousOutboundTime: order.outboundTime.toISOString(),
              newOutboundTime: item.target.toISOString(),
              reason: "按完整批次号逐笔采用来源出库时间",
              sourceFile: item.sourceFile,
              sourceRow: item.sourceRow,
            }),
          },
        });
      }
      const saved = await tx.outboundOrder.findMany({
        where: { code: { in: [...seen] } }, select: { code: true, outboundTime: true },
      });
      const savedByCode = new Map(saved.map((order) => [order.code, order.outboundTime.getTime()]));
      if (normalized.some((item) => savedByCode.get(item.code) !== item.target.getTime())) {
        throw new Error("写入后逐笔核对失败，整批回滚");
      }
    }
    return {
      applied: !!options.apply,
      total: items.length,
      count: changes.length,
      skipped: items.length - changes.length,
      results: changes.map((item) => ({
        code: item.code,
        sourceRow: item.sourceRow,
        previous: formatFullDateTime(byCode.get(item.code)!.outboundTime),
        updated: formatFullDateTime(item.target),
      })),
    };
  }, { isolationLevel: "Serializable", timeout: 60_000 });
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log(`默认只预览，不写入数据库：
  pnpm exec tsx scripts/update-outbound-time.ts --excel "出库单.xlsx"
  pnpm exec tsx scripts/update-outbound-time.ts CK-20261007-011 "2026-10-07 11:45"
执行修改：在上述命令后添加 --apply --operator <管理员用户ID>
已移除按前缀统一赋值功能。`);
    return;
  }
  const positional: string[] = [];
  let apply = false;
  let operatorId: string | undefined;
  let excelFile: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--apply") apply = true;
    else if (arg === "--excel" || arg === "--operator") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} 缺少参数`);
      if (arg === "--excel") excelFile = value;
      else operatorId = value;
    } else if (arg.startsWith("--")) throw new Error(`不支持参数：${arg}`);
    else positional.push(arg);
  }
  if (excelFile ? positional.length !== 0 : positional.length !== 2) throw new Error("请提供 Excel 文件或完整批次号和出库时间");
  const items = excelFile
    ? readOutboundTimeItems(XLSX.readFile(resolve(excelFile), { cellDates: false }), basename(excelFile))
    : [{ code: positional[0], newOutboundTime: positional[1] }];
  const result = await updateOutboundTimes(items, { apply, operatorId });
  console.table(result.results);
  console.log(`${result.applied ? "已执行并逐笔核对" : "仅预览，未写入"}：共 ${result.total} 笔，差异 ${result.count} 笔，一致 ${result.skipped} 笔。`);
}

if (process.argv[1] && /update-outbound-time\.(ts|js)$/.test(process.argv[1])) {
  main().catch((error) => {
    // 不输出数据库连接错误全文，避免连接配置进入终端记录。
    console.error("执行失败：", error instanceof Error && error.name.startsWith("Prisma") ? error.name : error.message);
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
}
