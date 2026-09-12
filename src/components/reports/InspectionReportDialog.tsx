"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Edit2, FileText, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  const isEditing = !!report;
  const form = useForm<InspectionReportFormValues>({
    resolver: zodResolver(inspectionReportFormSchema),
    defaultValues: getValues(report),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(getValues(report));
    setFile(null);
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

  async function onSubmit(data: InspectionReportFormValues) {
    if (!isEditing && !file) {
      toast.error("请选择检测报告附件");
      return;
    }

    setLoading(true);
    try {
      if (isEditing && report) {
        await updateInspectionReportAction({
          id: report.id,
          name: data.name,
          inspectedAt: data.inspectedAt,
        });
        toast.success("检测报告已更新");
      } else if (file) {
        const formData = new FormData();
        formData.append("file", file);
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
            {isEditing ? "修改报告名称和检测时间，原始附件与上传留痕保持不变。" : "以报告名称归档，上传时间和上传人由系统自动记录。"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium">报告附件</label>
              <div className="rounded-md border border-dashed p-3">
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
                    <Upload className="size-4" />
                    选择 PDF / JPG / PNG 文件
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      className="hidden"
                      onChange={(event) => handleFileChange(event.target.files?.[0])}
                    />
                  </label>
                )}
              </div>
              <p className="text-muted-foreground text-[11px]">
                {isEditing ? "编辑时不替换原始附件。" : "单个文件最大 10MB。"}
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
                  <FormLabel>检测时间</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormDescription>没有准确检测时间时可以留空。</FormDescription>
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
