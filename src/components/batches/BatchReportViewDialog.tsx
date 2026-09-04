"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileCheck, ExternalLink, Download } from "lucide-react";

interface BatchReportViewDialogProps {
  batchCode: string;
  reportName: string;
  reportUrl: string;
  title?: string;
  trigger?: React.ReactNode;
}

export function BatchReportViewDialog({
  batchCode,
  reportName,
  reportUrl,
  title,
  trigger,
}: BatchReportViewDialogProps) {
  const isPdf = reportName.toLowerCase().endsWith(".pdf") || reportUrl.startsWith("data:application/pdf");

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary gap-1 px-2 font-medium">
            <FileCheck className="size-3.5" />
            查看报告
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>{title || `原料批次检测报告 (${batchCode})`}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            文件名称: {reportName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-md border bg-muted/20 p-2 min-h-[300px] flex items-center justify-center">
          {isPdf ? (
            <iframe
              src={reportUrl}
              className="w-full h-[450px] rounded border"
              title="监测报告预览"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reportUrl}
              alt="批次检测报告"
              className="max-w-full max-h-[450px] object-contain rounded"
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" className="text-xs gap-1" asChild>
            <a href={reportUrl} download={reportName || `${batchCode}-report`} target="_blank" rel="noopener noreferrer">
              <Download className="size-3.5" />
              下载原件
            </a>
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1" asChild>
            <a href={reportUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              新窗口打开
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
