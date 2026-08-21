"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadBatchReportAction } from "@/actions/batches";
import { toast } from "sonner";
import { Upload, FileText, X } from "lucide-react";

export function BatchReportUploadDialog({
  batchId,
  batchCode,
  currentReportName,
  userId,
}: {
  batchId: string;
  batchCode: string;
  currentReportName?: string | null;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportName, setReportName] = useState(currentReportName || "");
  const [reportUrl, setReportUrl] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("文件不能超过 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setReportUrl(reader.result as string);
      setReportName(file.name);
      toast.success(`已选择文件: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportUrl) {
      toast.error("请先选择要上传的报告文件");
      return;
    }

    setLoading(true);
    try {
      await uploadBatchReportAction({
        batchId,
        reportUrl,
        reportName,
        userId,
      });

      toast.success("监测报告上传成功！");
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "上传失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2">
          <Upload className="size-3" />
          {currentReportName ? "替换报告" : "上传报告"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>上传批次监测报告</DialogTitle>
          <DialogDescription>
            为批次 <span className="font-mono font-bold text-foreground">{batchCode}</span> 绑定药残检测报告或产地准出证明。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">选择报告文件 (PDF / JPG / PNG)</Label>
            {reportName && reportUrl ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="size-4 text-primary shrink-0" />
                  <span className="truncate font-medium">{reportName}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setReportName("");
                    setReportUrl("");
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-md border border-dashed p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                <Upload className="size-5 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground font-medium">点击选择本地检测报告</span>
                <span className="text-[10px] text-muted-foreground">文件大小最大支持 10MB</span>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading || !reportUrl}>
              {loading ? "上传中..." : "确认上传"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
