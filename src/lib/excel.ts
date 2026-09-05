import * as XLSX from "xlsx";

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
