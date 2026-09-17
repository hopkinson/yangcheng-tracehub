"use client";

import { useState, useTransition, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, FileCheck, Loader2, AlertTriangle, X } from "lucide-react";
import { createQCRecordAction, getQCInspectorsAction } from "@/actions/qc";
import { uploadFileAction } from "@/actions/upload";
import { cn, getBeijingTimeString, getPreviewFileUrl } from "@/lib/utils";

const ROLE_NAME_MAP: Record<string, string> = {
  ADMIN: "超级管理员",
  QA_DIRECTOR: "质检员",
  WAREHOUSE_ADMIN: "库管员",
  FARMER_ADMIN: "内部核验员",
  CHANNEL_VIEWER: "渠道审计员",
};

const formatInspectorName = (u: { fullName: string; role: string }) =>
  u.fullName.includes("(") ? u.fullName : `${u.fullName} (${ROLE_NAME_MAP[u.role] || u.role})`;

const getDefaultCheckTime = () => (getBeijingTimeString(new Date()) || "").slice(0, 16).replace(" ", "T");

export const STANDARD_QC_CONCLUSIONS = ["合格", "不合格", "待整改"] as const;

export interface QCConfig {
  cat: string;
  categoryLabel: string;
  defaultTitle: string;
  formNoPreset?: string;
  refType: string;
  refId: string;
  conclusions?: string[];
  refOptions?: Array<{ label: string; value: string }>;
}

export function QCRecordDialog({
  config,
  triggerLabel = "上传品控记录",
  triggerClassName,
  trigger,
  users,
}: {
  config: QCConfig;
  triggerLabel?: string;
  triggerClassName?: string;
  trigger?: React.ReactNode;
  users?: Array<{ id: string; fullName: string; role: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [userList, setUserList] = useState<Array<{ id: string; fullName: string; role: string }>>(users || []);
  const [uploader, setUploader] = useState<string>("赵质检 (质检员)");

  useEffect(() => {
    if (open && userList.length === 0) {
      getQCInspectorsAction().then((res) => {
        if (res?.length) {
          setUserList(res);
          const defaultUser = res.find((u) => u.role === "QA_DIRECTOR") || res[0];
          if (defaultUser) setUploader(formatInspectorName(defaultUser));
        }
      });
    }
  }, [open, userList.length]);

  const conclusionsList = config.conclusions && config.conclusions.length > 0
    ? config.conclusions
    : STANDARD_QC_CONCLUSIONS;

  const [selectedRefId, setSelectedRefId] = useState(config.refId || config.refOptions?.[0]?.value || "");

  const [formNo, setFormNo] = useState(config.formNoPreset || "");
  const [checkTime, setCheckTime] = useState(getDefaultCheckTime);
  const [conclusion, setConclusion] = useState(conclusionsList[0] || "合格");
  const [reason, setReason] = useState("");
  const [fileUrl, setFileUrl] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const isPdf = fileName.toLowerCase().endsWith(".pdf");

  const isUnqualified = conclusion === "不合格";
  const isRectifying = conclusion === "待整改";
  const isExceptionConclusion = isUnqualified || isRectifying;

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
      setFileUrl(res.url);
      setFileName(res.name);
      toast.success(`文件已上传: ${res.name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "文件上传失败";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetRefId = selectedRefId || config.refId;
    if (!targetRefId) {
      toast.error("请选择或指定关联对象！");
      return;
    }

    if (isExceptionConclusion && !reason.trim()) {
      toast.error(
        isUnqualified
          ? "结论判定为不合格时，必须填写不合格原因与处置说明！"
          : isRectifying
          ? "结论判定为待整改时，必须填写问题详情与整改要求说明！"
          : "结论判定为异常时，必须填写整改原因说明！"
      );
      return;
    }

    startTransition(async () => {
      const res = await createQCRecordAction({
        cat: config.cat,
        formNo,
        refType: config.refType,
        refId: targetRefId,
        title: config.defaultTitle,
        checkTime,
        conclusion,
        reason,
        uploader: uploader || "赵质检 (质检员)",
        fileName: fileName || undefined,
        fileUrl: fileUrl || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setCheckTime(getDefaultCheckTime());
          setSelectedRefId(config.refId || config.refOptions?.[0]?.value || "");
        }
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="outline" size="sm" className={cn("h-7 px-1.5 text-[11px] gap-1", triggerClassName)}>
            <Camera className="size-3 text-primary shrink-0" />
            <span className="truncate">{triggerLabel}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <FileCheck className="size-5 text-primary" />
            {config.categoryLabel}留痕上传
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            关联对象：<span className="font-mono font-bold text-foreground">{selectedRefId || config.refId || "待选择"}</span> · 强制填报实际巡检时间以暴露后填补录问题。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 flex-1 overflow-y-auto px-1 py-1">
          <div className="space-y-1">
            <Label className="text-xs">质检表名称</Label>
            <div className="h-8 flex items-center rounded-md border bg-muted/30 px-3 text-xs text-foreground">
              {config.defaultTitle}
            </div>
          </div>

          {config.refOptions && config.refOptions.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-primary">关联对象/批次 (必选)</Label>
              <Select value={selectedRefId} onValueChange={setSelectedRefId}>
                <SelectTrigger className="h-8 text-xs font-mono">
                  <SelectValue placeholder="请选择关联对象" />
                </SelectTrigger>
                <SelectContent>
                  {config.refOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs font-mono">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">纸质表号 (YCGF-PZZX)</Label>
              <Input
                value={formNo}
                onChange={(e) => setFormNo(e.target.value)}
                placeholder="例如：YCGF-PZZX-202604"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-primary">实际巡检/校准时间 (必填)</Label>
              <Input
                type="datetime-local"
                value={checkTime}
                onChange={(e) => setCheckTime(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-primary">质检人员 (必填)</Label>
              <Select value={uploader} onValueChange={setUploader}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="请选择质检人员" />
                </SelectTrigger>
                <SelectContent>
                  {userList.map((u) => {
                    const label = formatInspectorName(u);
                    return (
                      <SelectItem key={u.id} value={label} className="text-xs">
                        {label}
                      </SelectItem>
                    );
                  })}
                  {userList.length === 0 && (
                    <SelectItem value={uploader} className="text-xs">
                      {uploader}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">检查结论判定</Label>
              <Select value={conclusion} onValueChange={setConclusion}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conclusionsList.map((c, idx) => (
                    <SelectItem key={idx} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isExceptionConclusion && (
            <div
              className={cn(
                "space-y-1 p-2.5 rounded border",
                isRectifying
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-destructive/10 border-destructive/30"
              )}
            >
              <Label
                className={cn(
                  "text-xs font-semibold flex items-center gap-1",
                  isRectifying ? "text-amber-600 dark:text-amber-400" : "text-destructive"
                )}
              >
                <AlertTriangle className="size-3.5" />
                {isUnqualified
                  ? "不合格原因与处置说明 (必填)"
                  : isRectifying
                  ? "问题详情与整改要求说明 (必填)"
                  : "异常原因与整改说明 (异常必填)"}
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  isUnqualified
                    ? "请说明指标严重不合格或超标详情，以及退回/拦截处理措施..."
                    : isRectifying
                    ? "请说明现场发现的问题或偏差，以及具体整改要求与复查安排..."
                    : "例如：指标超标或环境异常，已启动应急措施并复检..."
                }
                className="text-xs h-16 resize-none font-mono"
              />
            </div>
          )}

          {/* 原件 */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
            <Label className="text-xs">现场纸质记录原件（图片/PDF）</Label>

            {fileUrl ? (
              <div className="space-y-2">
                <div className="border rounded overflow-hidden bg-background p-1 flex items-center justify-center max-h-40 relative group">
                  {isPdf ? (
                    <a
                      href={getPreviewFileUrl(fileUrl, fileName)}
                      target="_blank"
                      rel="noreferrer"
                      className="h-24 w-full flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <FileCheck className="size-8 text-primary" />
                      <span className="max-w-[80%] truncate">{fileName || "PDF 原件"}</span>
                    </a>
                  ) : (
                    <img src={getPreviewFileUrl(fileUrl, fileName)} alt="原件预览" className="max-h-36 object-contain rounded" />
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-6 px-2 text-[11px] gap-1 shadow-sm"
                    onClick={() => {
                      setFileUrl("");
                      setFileName("");
                    }}
                  >
                    <X className="size-3" /> 移除
                  </Button>
                </div>
                {fileName && <div className="text-[11px] text-muted-foreground truncate">{fileName}</div>}
              </div>
            ) : (
              <label className="h-24 border border-dashed rounded flex flex-col items-center justify-center text-xs text-muted-foreground gap-1.5 bg-background/50 hover:bg-muted/50 cursor-pointer transition-colors">
                {uploading ? (
                  <>
                    <Loader2 className="size-6 text-primary animate-spin" />
                    <span>文件上传中...</span>
                  </>
                ) : (
                  <>
                    <Camera className="size-6 text-muted-foreground/60" />
                    <span>点击上传现场纸质记录原件（图片/PDF）</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="gap-1 bg-primary text-primary-foreground">
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              确认保存并留痕
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
