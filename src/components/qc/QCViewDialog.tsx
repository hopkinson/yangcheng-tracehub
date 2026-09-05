"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSearch, Clock, AlertTriangle, CheckCircle2, ExternalLink, Download, FileWarning, FileText } from "lucide-react";
import { getPreviewFileUrl } from "@/lib/utils";

export function QCViewDialog({
  record,
  triggerText = "查看原件",
}: {
  record: {
    code: string;
    formNo?: string | null;
    title: string;
    refId: string;
    checkTime: Date | string;
    uploadTime: Date | string;
    result: string;
    conclusion?: string | null;
    reason?: string | null;
    uploader: string;
    fileName?: string | null;
    fileUrl?: string | null;
  };
  triggerText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const safePreviewUrl = record.fileUrl ? getPreviewFileUrl(record.fileUrl, record.fileName || undefined) : "";
  const isPdf = /\.pdf$/i.test(record.fileName || "") || /\.pdf$/i.test(record.fileUrl || "") || record.fileUrl?.startsWith("data:application/pdf");

  const checkDateStr = typeof record.checkTime === "string" ? record.checkTime : record.checkTime.toISOString().slice(5, 16).replace("T", " ");
  const uploadDateStr = typeof record.uploadTime === "string" ? record.uploadTime : record.uploadTime.toISOString().slice(5, 16).replace("T", " ");
  const isException = record.result === "EXCEPTION" || record.result === "UNQUALIFIED";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) setImageError(false); setOpen(o); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-xs text-primary gap-1 px-1.5 font-normal">
          <FileSearch className="size-3" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <span>{record.title}</span>
              <Badge variant="outline" className="font-mono text-[11px]">
                {record.code}
              </Badge>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> 检查时间：{checkDateStr}
            </span>
            <span>·</span>
            <span>质检人：{record.uploader}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-y-auto py-1">
          {/* 单号关联信息 */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded border">
            <div>
              <span className="text-muted-foreground">关联单号：</span>
              <span className="font-mono font-medium">{record.formNo || "未填写"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">上传时间：</span>
              <span className="font-mono">{uploadDateStr}</span>
            </div>
          </div>

          {/* 结论与原因 */}
          <div className="p-3 rounded border bg-card text-xs space-y-1">
            <div className="font-medium text-foreground">
              检查结论：<span className={isException ? "text-destructive font-bold" : "text-emerald-600"}>{record.conclusion || "合格"}</span>
            </div>
            {record.reason && (
              <div className="text-destructive text-[11px] font-mono pt-1 border-t">
                异常整改原因：{record.reason}
              </div>
            )}
          </div>

          {/* 原件照片 / PDF */}
          <div className="border rounded-lg overflow-hidden bg-muted/20 p-2 flex items-center justify-center min-h-48">
            {safePreviewUrl ? (
              isPdf ? (
                <iframe
                  src={safePreviewUrl}
                  className="w-full h-80 rounded border-0 bg-background"
                  title="品控凭证 PDF 预览"
                />
              ) : imageError ? (
                <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                  <FileWarning className="size-8 text-amber-500" />
                  <span className="text-xs text-muted-foreground">原件暂无法直接内嵌预览</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 mt-1" asChild>
                    <a href={safePreviewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3" />
                      在新窗口尝试打开
                    </a>
                  </Button>
                </div>
              ) : (
                <a
                  href={safePreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="点击在新窗口查看大图原件"
                  className="group relative block"
                >
                  <img
                    src={safePreviewUrl}
                    alt="品控原件"
                    onError={() => setImageError(true)}
                    className="max-h-72 object-contain rounded border shadow-xs transition-opacity group-hover:opacity-90 cursor-zoom-in"
                  />
                </a>
              )
            ) : (
              <div className="text-xs text-muted-foreground">现场纸质件留档（纯原图展示）</div>
            )}
          </div>
        </div>

        {/* 底部操作按钮栏 */}
        {safePreviewUrl && (
          <div className="flex items-center justify-between pt-2 border-t text-xs">
            <span className="text-muted-foreground truncate max-w-[240px]">
              {record.fileName || (isPdf ? "品控报告.pdf" : "品控凭证原件")}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                <a
                  href={safePreviewUrl}
                  download={record.fileName || `${record.code}-proof`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
        )}
      </DialogContent>
    </Dialog>
  );
}
