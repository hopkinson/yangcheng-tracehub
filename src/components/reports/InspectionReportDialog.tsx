"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Edit2, FileText, Loader2, Plus, RefreshCw, Trash2, Undo2, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn, getFileDropHandlers } from "@/lib/utils";
import {
  createInspectionReportAction,
  deleteInspectionReportAction,
  updateInspectionReportAction,
} from "@/actions/reports";
import {
  inspectionReportFormSchema,
  type InspectionReportFormValues,
} from "@/lib/validations/schemas";

export interface InspectionReportData {
  id: string;
  name: string;
  fileName: string;
  licenseName?: string | null;
  licenseUrl?: string | null;
  inspectedAt: string;
}

function getValues(report?: InspectionReportData): InspectionReportFormValues {
  return {
    name: report?.name || "",
    inspectedAt: report?.inspectedAt || "",
  };
}

export function InspectionReportDialog({ report }: { report?: InspectionReportData }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [license, setLicense] = useState<File | "REMOVE" | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isDraggingLicense, setIsDraggingLicense] = useState(false);
  const isEditing = !!report;
  const form = useForm<InspectionReportFormValues>({
    resolver: zodResolver(inspectionReportFormSchema),
    defaultValues: getValues(report),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(getValues(report));
    setFile(null);
    setLicense(null);
  }, [open, report, form]);

  function handleFileChange(selected?: File) {
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) {
      toast.error("报告附件不能超过 10MB");
      return;
    }
    setFile(selected);
    if (!form.getValues("name").trim()) {
      form.setValue("name", selected.name.replace(/\.[^.]+$/, ""), { shouldValidate: true });
    }
  }

  function handleLicenseFileChange(selected?: File) {
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) {
      toast.error("营业执照不能超过 10MB");
      return;
    }
    setLicense(selected);
  }

  async function onSubmit(data: InspectionReportFormValues) {
    if (!isEditing && !file) {
      toast.error("请选择检测报告附件");
      return;
    }

    setLoading(true);
    try {
      if (isEditing && report) {
        const formData = new FormData();
        formData.append("id", report.id);
        formData.append("name", data.name);
        formData.append("inspectedAt", data.inspectedAt || "");
        if (license instanceof File) {
          formData.append("licenseFile", license);
        } else if (license === "REMOVE") {
          formData.append("removeLicense", "true");
        }
        await updateInspectionReportAction(formData);
        toast.success("检测报告已更新");
      } else if (file) {
        const formData = new FormData();
        formData.append("file", file);
        if (license instanceof File) formData.append("licenseFile", license);
        formData.append("name", data.name);
        formData.append("inspectedAt", data.inspectedAt || "");
        await createInspectionReportAction(formData);
        toast.success("检测报告已上传");
      }
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存检测报告失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && setOpen(next)}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Edit2 className="size-3.5" />
            编辑
          </Button>
        ) : (
          <Button className="gap-1.5">
            <Plus className="size-4" />
            上传检测报告
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "编辑检测报告" : "上传检测报告"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "修改报告名称、检测日期，或维护营业执照资质（主报告附件保持不变）。"
              : "以报告名称归档，上传时间和上传人由系统自动记录。"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium">报告附件</label>
              <div
                {...getFileDropHandlers(handleFileChange, setIsDraggingFile, isEditing)}
                className={cn(
                  "rounded-md border p-3 transition-all",
                  isDraggingFile
                    ? "border-primary bg-primary/10 border-solid ring-2 ring-primary/20"
                    : "border-dashed"
                )}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="size-4 shrink-0 text-primary" />
                    <span className="truncate font-medium">{report.fileName}</span>
                  </div>
                ) : file ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      <FileText className="size-4 shrink-0 text-primary" />
                      <span className="truncate font-medium">{file.name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={() => setFile(null)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground">
                    <Upload className={cn("size-4", isDraggingFile && "text-primary animate-bounce")} />
                    <span>{isDraggingFile ? "松开鼠标即可上传报告文件" : "点击或拖拽上传 PDF / JPG / PNG 文件"}</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      className="hidden"
                      onChange={(event) => {
                        handleFileChange(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              <p className="text-muted-foreground text-[11px]">
                {isEditing ? "编辑时不替换主报告附件。" : "单个文件最大 10MB。"}
              </p>
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">营业执照（选填）</label>
                {isEditing && !license && report.licenseName && (
                  <span className="text-[11px] text-muted-foreground">已归档原件</span>
                )}
              </div>

              <div
                {...getFileDropHandlers(handleLicenseFileChange, setIsDraggingLicense)}
                className={cn(
                  "rounded-md border p-3 transition-all",
                  isDraggingLicense
                    ? "border-primary bg-primary/10 border-solid ring-2 ring-primary/20"
                    : "border-dashed"
                )}
              >
                {license instanceof File ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      <FileText className="size-4 shrink-0 text-primary" />
                      <span className="truncate font-medium">{license.name}</span>
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {isEditing && report.licenseName ? "待替换" : "待上传"}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={() => setLicense(null)}
                      title="取消选择"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : license === "REMOVE" ? (
                  <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span className="truncate line-through">原营业执照：{report?.licenseName}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => setLicense(null)}
                    >
                      <Undo2 className="size-3.5" />
                      撤销移除
                    </Button>
                  </div>
                ) : isEditing && report.licenseName ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium text-foreground">{report.licenseName}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                        <RefreshCw className="size-3" />
                        更换
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          className="hidden"
                          onChange={(event) => {
                            handleLicenseFileChange(event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setLicense("REMOVE")}
                      >
                        <Trash2 className="size-3" />
                        移除
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground">
                    <Upload className={cn("size-4", isDraggingLicense && "text-primary animate-bounce")} />
                    <span>
                      {isDraggingLicense
                        ? "松开鼠标即可上传营业执照"
                        : isEditing
                        ? "点击或拖拽补传营业执照 (PDF / JPG / PNG)"
                        : "点击或拖拽选择 PDF / JPG / PNG 文件"}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      className="hidden"
                      onChange={(event) => {
                        handleLicenseFileChange(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              <p className="text-muted-foreground text-[11px]">
                {isEditing
                  ? "支持补传、更换或移除配套营业执照，单个文件最大 10MB。"
                  : "单个文件最大 10MB。"}
              </p>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>报告名称</FormLabel>
                  <FormControl>
                    <Input placeholder="如：大闸蟹兽药残留专项检测报告" {...field} />
                  </FormControl>
                  <FormDescription>检测类型较多时直接通过名称体现检测范围。</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="inspectedAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>检测日期</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>没有准确检测日期时可以留空。</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {isEditing ? "保存修改" : "确认上传"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function InspectionReportDeleteButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteInspectionReportAction(id);
        toast.success("检测报告已删除");
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "删除检测报告失败");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" />
        删除
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="确认删除检测报告"
        description={`确定要删除【${name}】吗？\n\n删除后报告记录及附件将被清理，此操作不可撤销。`}
        confirmText="确认删除"
        variant="destructive"
        loading={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
