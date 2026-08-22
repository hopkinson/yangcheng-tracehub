"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintTraceButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 text-xs print:hidden"
      onClick={() => window.print()}
    >
      <Printer className="size-3.5" />
      打印/导出证明 (PDF)
    </Button>
  );
}
