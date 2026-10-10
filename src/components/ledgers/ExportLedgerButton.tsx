"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
interface ExportLedgerButtonProps {
  filename: string;
  exportUrl: string;
  label?: string;
}

export function ExportLedgerButton({
  filename,
  exportUrl,
  label = "导出 Excel",
}: ExportLedgerButtonProps) {
  const [pending, setPending] = useState(false);
  async function handleExport() {
    setPending(true);
    try {
      const response = await fetch(exportUrl);
      if (!response.ok) throw new Error((await response.json()).error || "导出失败");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "导出失败，请稍后重试"); }
    finally { setPending(false); }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={pending} className="flex items-center gap-1.5 text-xs">
      <Download className="size-3.5" data-icon="inline-start" />
      {pending ? "导出中…" : label}
    </Button>
  );
}
