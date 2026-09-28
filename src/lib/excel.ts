import * as XLSX from "xlsx";

export type ExportValue = string | number | boolean | null | undefined;
export type ExportSection = { title?: string; headers: string[]; rows: ExportValue[][] };

/**
 * 读取 Excel 文件 (.xlsx, .xls, .csv) 并转换为 TSV 纯文本供解析器统一处理
 */
export async function readExcelFile(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const workbook = XLSX.read(data, { type: "array", cellDates: true, dateNF: "YYYY-MM-DD" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return firstSheet ? XLSX.utils.sheet_to_csv(firstSheet, { FS: "\t" }) : "";
}

/**
 * 导出 Excel 模板
 */
export function downloadExcelTemplate(
  filename: string,
  headers: string[],
  sampleRows: (string | number)[][]
) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "模板");
  XLSX.writeFile(wb, filename);
}

/**
 * 格式化超链接完整 URL (若为相对路径则通过 URL 解析器自动补全 origin)
 */
export function resolveAbsoluteUrl(url: string, origin?: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed === "—") return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base =
    origin ||
    (typeof window !== "undefined" && window.location?.origin) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";
  if (!base) return trimmed;
  try {
    return new URL(trimmed, base).href;
  } catch {
    return trimmed;
  }
}

/**
 * 生成包含超链接支持的完整 Excel Workbook
 */
export function generateLedgerWorkbook(options: {
  sheetName: string;
  headers?: string[];
  rows?: ExportValue[][];
  sections?: ExportSection[];
  origin?: string;
}): XLSX.WorkBook {
  const { sheetName, headers = [], rows = [], sections, origin } = options;
  const exportSections: ExportSection[] = sections?.length ? sections : [{ headers, rows }];

  const aoa: (string | number | boolean)[][] = [];
  exportSections.forEach((section, index) => {
    if (index > 0) aoa.push([]);
    if (section.title) aoa.push([section.title]);
    aoa.push(section.headers);
    section.rows.forEach((row) => {
      aoa.push(
        row.map((cell) => {
          if (
            typeof cell === "string" &&
            (cell.startsWith("/uploads/") || cell.startsWith("/api/files/") || /^https?:\/\//i.test(cell))
          ) {
            return resolveAbsoluteUrl(cell, origin);
          }
          return cell ?? "—";
        })
      );
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 遍历单元格，为所有 URL 自动挂载 OpenXML 原生超链接
  for (const key of Object.keys(ws)) {
    if (key.startsWith("!")) continue;
    const cell = ws[key];
    if (typeof cell?.v === "string" && /^https?:\/\//i.test(cell.v)) {
      cell.l = { Target: cell.v, Tooltip: "点击打开附件" };
    }
  }

  ws["!cols"] = Array.from({ length: Math.max(1, ...aoa.map((r) => r.length)) }, (_, i) => ({
    wch: Math.min(40, Math.max(10, ...aoa.map((r) => String(r[i] ?? "").length + 2))),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return wb;
}
