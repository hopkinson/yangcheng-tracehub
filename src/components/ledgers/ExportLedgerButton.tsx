"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ExportLedgerButtonProps {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  label?: string;
}

export function ExportLedgerButton({
  filename,
  headers,
  rows,
  label = "导出台账 (CSV/Excel)",
}: ExportLedgerButtonProps) {
  function handleExport() {
    const csvContent =
      "\uFEFF" + // UTF-8 BOM for Excel Chinese compatibility
      [
        headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${filename}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center gap-1.5 text-xs">
      <Download className="size-3.5" data-icon="inline-start" />
      {label}
    </Button>
  );
}
