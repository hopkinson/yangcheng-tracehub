"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getPreviewFileUrl } from "@/lib/utils";
import { FileCheck } from "lucide-react";

interface BatchReportViewDialogProps {
  batchCode?: string;
  reportName: string;
  reportUrl: string;
  title?: string;
  trigger?: React.ReactNode;
}

export function BatchReportViewDialog({
  reportName,
  reportUrl,
  trigger,
}: BatchReportViewDialogProps) {
  const url = getPreviewFileUrl(reportUrl, reportName);
  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  if (React.isValidElement(trigger)) {
    const originalOnClick = (trigger.props as { onClick?: React.MouseEventHandler })?.onClick;
    return React.cloneElement(trigger as React.ReactElement<Record<string, unknown>>, {
      onClick: (e: React.MouseEvent) => {
        originalOnClick?.(e);
        handleOpen(e);
      },
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 text-xs text-primary gap-1 px-2 font-medium"
      onClick={handleOpen}
    >
      <FileCheck className="size-3.5" />
      查看报告
    </Button>
  );
}
