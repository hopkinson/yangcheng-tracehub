"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { getBeijingDateStr } from "@/lib/utils";
import * as XLSX from "xlsx";

type ExportValue = string | number;

type ExportSection = {
  title?: string;
  headers: string[];
  rows: ExportValue[][];
};

interface ExportLedgerButtonProps {
  filename: string;
  sheetName: string;
  headers?: string[];
  rows?: ExportValue[][];
  sections?: ExportSection[];
  label?: string;
}

export function ExportLedgerButton({
  filename,
  sheetName,
  headers = [],
  rows = [],
  sections,
  label = "导出 Excel",
}: ExportLedgerButtonProps) {
  function handleExport() {
    const aoa: ExportValue[][] = [];
    const exportSections = sections?.length ? sections : [{ headers, rows }];

    exportSections.forEach((section, index) => {
      if (index > 0) aoa.push([]);
      if (section.title) aoa.push([section.title]);
      aoa.push(section.headers);
      aoa.push(...section.rows);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet["!cols"] = Array.from({ length: Math.max(1, ...aoa.map((row) => row.length)) }, (_, colIndex) => ({
      wch: Math.min(
        32,
        Math.max(
          10,
          ...aoa.map((row) => String(row[colIndex] ?? "").length + 2)
        )
      ),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
    XLSX.writeFile(workbook, `${filename}_${getBeijingDateStr()}.xlsx`);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center gap-1.5 text-xs">
      <Download className="size-3.5" data-icon="inline-start" />
      {label}
    </Button>
  );
}
