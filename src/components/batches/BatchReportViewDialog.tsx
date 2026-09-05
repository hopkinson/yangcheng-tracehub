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
import { getPreviewFileUrl } from "@/lib/storage";
import { FileCheck, ExternalLink, Download, Loader2, AlertCircle } from "lucide-react";

interface BatchReportViewDialogProps {
  batchCode?: string;
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
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadFailed, setLoadFailed] = React.useState(false);

  const safePreviewUrl = React.useMemo(() => {
    return getPreviewFileUrl(reportUrl, reportName);
  }, [reportUrl, reportName]);

  const isExplicitImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(reportName) || /\.(png|jpe?g|webp|gif|svg)$/i.test(reportUrl) || reportUrl.startsWith("data:image/");
  const isPdf = !isExplicitImage && (/\.pdf$/i.test(reportName) || /\.pdf$/i.test(reportUrl) || /报告|合同/i.test(reportName) || reportUrl.startsWith("data:application/pdf"));

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      setLoadFailed(false);
    }
  }, [open, reportUrl]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6 text-sm font-semibold">
            <span>{title || (batchCode ? `原料批次检测报告 (${batchCode})` : "文件原件预览")}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground truncate">
            文件名称: {reportName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-md border bg-muted/20 min-h-[420px] flex items-center justify-center relative p-1">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-xs z-10">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">正在加载文件原件预览...</span>
            </div>
          )}

          {loadFailed ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2 max-w-sm px-4">
              <AlertCircle className="size-10 text-amber-500" />
              <div className="text-sm font-medium text-foreground">内嵌预览未能直接载入</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                受浏览器内嵌 PDF 插件策略或网络限制影响，您可直接通过下方按钮在新标签页打开或下载查看。
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button variant="outline" size="sm" className="text-xs gap-1" asChild>
                  <a href={safePreviewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" /> 新窗口打开
                  </a>
                </Button>
                <Button size="sm" className="text-xs gap-1" asChild>
                  <a href={safePreviewUrl} download={reportName || "attachment"}>
                    <Download className="size-3.5" /> 下载原件
                  </a>
                </Button>
              </div>
            </div>
          ) : isPdf ? (
            <iframe
              src={safePreviewUrl}
              className="w-full h-[500px] rounded border-0 bg-background"
              title="监测报告或合同原件预览"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setLoadFailed(true);
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={safePreviewUrl}
              alt={reportName || "检测报告原件"}
              className="max-w-full max-h-[500px] object-contain rounded"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setLoadFailed(true);
              }}
            />
          )}
        </div>

        <div className="flex justify-between items-center pt-2 border-t text-xs text-muted-foreground">
          <span className="truncate max-w-[280px]">
            {isPdf ? "PDF 凭证文件" : "图片凭证原件"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
              <a href={safePreviewUrl} download={reportName || (batchCode ? `${batchCode}-report` : "file")}>
                <Download className="size-3.5" />
                下载原件
              </a>
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
              <a href={safePreviewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                新窗口打开
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
