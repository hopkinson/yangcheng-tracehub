"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadBatchReportAction, deleteBatchReportAction } from "@/actions/batches";
import { uploadFileAction } from "@/actions/upload";
import { toast } from "sonner";
import { Upload, FileText, X, Trash2 } from "lucide-react";

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
  const [uploading, setUploading] = useState(false);
  const [reportName, setReportName] = useState(currentReportName || "");
  const [reportUrl, setReportUrl] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("文件不能超过 10MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadFileAction(formData);
      setReportUrl(res.url);
      setReportName(res.name);
      toast.success(`文件上传成功: ${res.name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "文件上传失败";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = () => {
    if (!confirm("确定要删除该批次的检测报告文件吗？")) return;
    toast.promise(deleteBatchReportAction({ batchId, userId }), {
      loading: "正在删除...",
      success: () => {
        setReportName("");
        setReportUrl("");
        setOpen(false);
        return "检测报告已成功删除";
      },
      error: (err) => (err instanceof Error ? err.message : "删除失败"),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportUrl) return toast.error("请先选择要上传的报告文件");

    toast.promise(uploadBatchReportAction({ batchId, reportUrl, reportName, userId }), {
      loading: "上传中...",
      success: () => {
        setOpen(false);
        return "监测报告上传成功！";
      },
      error: (err) => (err instanceof Error ? err.message : "上传失败"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2">
          <Upload className="size-3" />
          {currentReportName ? "替换报告" : "上传报告"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>上传批次监测报告</DialogTitle>
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

          <div className="flex justify-between items-center pt-2">
            <div>
              {currentReportName && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="text-destructive hover:bg-destructive/10 text-xs gap-1 h-8"
                >
                  <Trash2 className="size-3.5" />
                  删除当前报告
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={uploading || !reportUrl}>
                {uploading ? "处理中..." : "确认上传"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
