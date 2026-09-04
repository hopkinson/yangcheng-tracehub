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
import { FileSearch, Clock, AlertTriangle, CheckCircle2, ExternalLink, Download, FileWarning } from "lucide-react";

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

  const checkDateStr = typeof record.checkTime === "string" ? record.checkTime : record.checkTime.toISOString().slice(5, 16).replace("T", " ");
  const uploadDateStr = typeof record.uploadTime === "string" ? record.uploadTime : record.uploadTime.toISOString().slice(5, 16).replace("T", " ");
  const isException = record.result === "EXCEPTION";

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setImageError(false); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-primary gap-1">
          <FileSearch className="size-3" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-base font-semibold pr-6">
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-primary">{record.code}</span>
              <span className="truncate">{record.title}</span>
            </div>
            {isException ? (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="size-3 mr-1" /> 异常/需整改
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                <CheckCircle2 className="size-3 mr-1" /> 合格
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <span>关联编号：<strong className="text-foreground font-mono">{record.refId}</strong></span>
            {record.formNo && <span>纸质表号：<strong className="text-foreground font-mono">{record.formNo}</strong></span>}
            <span>上传人：<strong className="text-foreground">{record.uploader}</strong></span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-y-auto px-1 py-2">
          {/* 双时间戳对比卡片 */}
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-muted/40 border text-xs font-mono">
            <div>
              <span className="text-[11px] text-muted-foreground block flex items-center gap-1">
                <Clock className="size-3 text-primary" /> 现场巡检/校准时间
              </span>
              <span className="font-bold text-foreground text-sm">{checkDateStr}</span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block flex items-center gap-1">
                <Clock className="size-3 text-muted-foreground" /> 系统上传登记时间
              </span>
              <span className="font-medium text-muted-foreground text-sm">{uploadDateStr}</span>
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

          {/* 原件照片 */}
          <div className="border rounded-lg overflow-hidden bg-muted/20 p-2 flex items-center justify-center min-h-48">
            {record.fileUrl ? (
              imageError ? (
                <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                  <FileWarning className="size-8 text-amber-500" />
                  <span className="text-xs text-muted-foreground">原件暂无法直接内嵌预览</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 mt-1" asChild>
                    <a href={record.fileUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3" />
                      在新窗口尝试打开
                    </a>
                  </Button>
                </div>
              ) : (
                <a
                  href={record.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="点击在新窗口查看大图原件"
                  className="group relative block"
                >
                  <img
                    src={record.fileUrl}
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
        {record.fileUrl && (
          <div className="flex items-center justify-between pt-2 border-t text-xs">
            <span className="text-muted-foreground truncate max-w-[240px]">
              {record.fileName || "品控凭证原件"}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                <a
                  href={record.fileUrl}
                  download={record.fileName || `${record.code}-proof`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="size-3.5" />
                  下载原件
                </a>
              </Button>
              <Button variant="default" size="sm" className="h-7 text-xs gap-1" asChild>
                <a href={record.fileUrl} target="_blank" rel="noopener noreferrer">
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
