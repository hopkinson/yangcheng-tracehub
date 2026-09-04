"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  Upload,
  FileCheck,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { uploadFileAction } from "@/actions/upload";
import { updateBatchInspectionAction } from "@/actions/batches";

export interface BatchInspectionDialogProps {
  batch: {
    id: string;
    code: string;
    formNo?: string | null;
    quickCheck?: string | null;
    quickCheckUrl?: string | null;
    quickCheckName?: string | null;
    sampleCheck?: string | null;
    sampleCheckUrl?: string | null;
    sampleCheckName?: string | null;
    farmer?: { name: string; code: string };
  };
  userId: string;
  trigger?: React.ReactNode;
}

function InspectionItem({
  title,
  sub,
  val,
  setVal,
  url,
  name,
  onUpload,
  onRemove,
  isUploading,
}: {
  title: string;
  sub: string;
  val: string;
  setVal: (v: string) => void;
  url: string;
  name: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  isUploading: boolean;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-2.5 bg-muted/20">
      <div className="flex items-center justify-between border-b pb-1.5">
        <Label className="text-xs font-semibold text-foreground">{title}</Label>
        <span className="text-[11px] text-muted-foreground">{sub}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setVal("QUALIFIED")}
          className={cn(
            "flex items-center justify-center gap-1 py-1 px-2 rounded-md border text-xs font-medium cursor-pointer transition-all",
            val === "QUALIFIED"
              ? "bg-emerald-500/15 text-emerald-600 border-emerald-500 font-semibold"
              : "bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          <CheckCircle2 className="size-3.5" /> 合格
        </button>
        <button
          type="button"
          onClick={() => setVal("UNQUALIFIED")}
          className={cn(
            "flex items-center justify-center gap-1 py-1 px-2 rounded-md border text-xs font-medium cursor-pointer transition-all",
            val === "UNQUALIFIED"
              ? "bg-destructive/15 text-destructive border-destructive font-semibold"
              : "bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          <XCircle className="size-3.5" /> 不合格
        </button>
        <button
          type="button"
          onClick={() => setVal("PENDING")}
          className={cn(
            "flex items-center justify-center gap-1 py-1 px-2 rounded-md border text-xs font-medium cursor-pointer transition-all",
            val === "PENDING"
              ? "bg-amber-500/15 text-amber-600 border-amber-500 font-semibold"
              : "bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          <Clock className="size-3.5" /> 待检测
        </button>
      </div>

      {url ? (
        <div className="flex items-center justify-between h-8 px-2.5 border rounded bg-background text-xs">
          <div className="flex items-center gap-1.5 truncate">
            <FileCheck className="size-3.5 text-emerald-600 shrink-0" />
            <span className="truncate text-[11px] font-medium">{name || "检测报告原件"}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : (
        <label className="h-8 border border-dashed rounded flex items-center justify-center gap-1.5 px-2 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
          {isUploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          <span>{isUploading ? "上传中..." : "上传报告原件 (PDF/图片)"}</span>
          <input type="file" accept="image/*,.pdf" className="hidden" disabled={isUploading} onChange={onUpload} />
        </label>
      )}
    </div>
  );
}

function getInitialForm(batch: BatchInspectionDialogProps["batch"]) {
  return {
    quickCheck: batch.quickCheck || "PENDING",
    quickUrl: batch.quickCheckUrl || "",
    quickName: batch.quickCheckName || "",
    sampleCheck: batch.sampleCheck || "PENDING",
    sampleUrl: batch.sampleCheckUrl || "",
    sampleName: batch.sampleCheckName || "",
  };
}

export function BatchInspectionDialog({ batch, userId, trigger }: BatchInspectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(() => getInitialForm(batch));
  const [uploading, setUploading] = useState<"quick" | "sample" | null>(null);

  const handleUpload = async (type: "quick" | "sample", file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("文件不能超过 10MB");

    setUploading(type);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadFileAction(fd);
      setForm((p) => ({
        ...p,
        [`${type}Url`]: res.url,
        [`${type}Name`]: res.name,
        [`${type}Check`]: p[`${type}Check` as keyof typeof p] === "PENDING" ? "QUALIFIED" : p[`${type}Check` as keyof typeof p],
      }));
      toast.success(`报告已上传: ${res.name}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateBatchInspectionAction({
        batchId: batch.id,
        quickCheck: form.quickCheck,
        quickCheckUrl: form.quickUrl || null,
        quickCheckName: form.quickName || null,
        sampleCheck: form.sampleCheck,
        sampleCheckUrl: form.sampleUrl || null,
        sampleCheckName: form.sampleName || null,
        inspectorId: userId,
      });

      if (!res.success) {
        toast.error(res.error || "保存失败");
        return;
      }
      toast.success(`批次 ${batch.code} 品控检测报告录入成功！`);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) setForm(getInitialForm(batch)); setOpen(o); }}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardCheck className="size-4 text-primary" />
            <span>品控检测报告 ({batch.code})</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {batch.farmer && `养殖户: ${batch.farmer.name} · `}
            {batch.formNo && `码单: ${batch.formNo} · `}
            上传报告并录入检测结论。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 flex-1 overflow-y-auto pt-1">
          <InspectionItem
            title="1. 农药与违禁残留快检"
            sub="有机磷 / 氨基甲酸酯等"
            val={form.quickCheck}
            setVal={(v) => setForm((p) => ({ ...p, quickCheck: v }))}
            url={form.quickUrl}
            name={form.quickName}
            onUpload={(e) => handleUpload("quick", e.target.files?.[0])}
            onRemove={() => setForm((p) => ({ ...p, quickUrl: "", quickName: "" }))}
            isUploading={uploading === "quick"}
          />

          <InspectionItem
            title="2. 品质抽检与试吃品评"
            sub="肉质、膏黄与口感"
            val={form.sampleCheck}
            setVal={(v) => setForm((p) => ({ ...p, sampleCheck: v }))}
            url={form.sampleUrl}
            name={form.sampleName}
            onUpload={(e) => handleUpload("sample", e.target.files?.[0])}
            onRemove={() => setForm((p) => ({ ...p, sampleUrl: "", sampleName: "" }))}
            isUploading={uploading === "sample"}
          />

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="gap-1 bg-primary text-primary-foreground">
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              保存报告
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
