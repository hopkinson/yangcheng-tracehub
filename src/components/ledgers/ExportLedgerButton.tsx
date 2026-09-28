"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { getBeijingDateStr } from "@/lib/utils";
import * as XLSX from "xlsx";
import {
  generateLedgerWorkbook,
  type ExportValue,
  type ExportSection,
} from "@/lib/excel";

export type { ExportValue, ExportSection };

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
    const workbook = generateLedgerWorkbook({
      sheetName,
      headers,
      rows,
      sections,
    });
    XLSX.writeFile(workbook, `${filename}_${getBeijingDateStr()}.xlsx`);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center gap-1.5 text-xs">
      <Download className="size-3.5" data-icon="inline-start" />
      {label}
    </Button>
  );
}
