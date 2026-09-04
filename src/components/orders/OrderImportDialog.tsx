"use client";

import { useState, useRef, useTransition } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  UploadCloud,
  Loader2,
  Download,
  FileCheck2,
} from "lucide-react";
import { importOrdersAction } from "@/actions/production";
import { Invariants, type RawImportOrder } from "@/lib/invariants";
import { getTenant } from "@/config/tenant";
import { readExcelFile, downloadExcelTemplate } from "@/lib/excel";

export function OrderImportDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"STORE" | "CARD">("CARD");

  const [inputText, setInputText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<RawImportOrder[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseText = (text: string, type: "STORE" | "CARD") => {
    const list = Invariants.parseOrderImportText(text, type, getTenant().storeLabel);
    setParsedPreview(list);
  };

  const handleFileUpload = async (file: File) => {
    try {
      setFileName(file.name);
      const tsv = await readExcelFile(file);
      setInputText(tsv);
      parseText(tsv, activeTab);
      toast.success(`文件 ${file.name} 解析完成`);
    } catch {
      toast.error("Excel 文件解析失败，请检查文件格式");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileUpload(f);
  };

  const handleDownloadTemplate = () => {
    if (activeTab === "CARD") {
      downloadExcelTemplate(
        "蟹卡提货批量导入模板.xlsx",
        ["提货单号", "提货规格型号", "要求发货日期"],
        [
          ["KK20260901001", "8只装礼盒(4.0母蟹X4只, 4.5公蟹X4只)", "2026-09-22"],
          ["KK20260901002", "10只装尊享礼盒(3.5母蟹X5只, 4.0公蟹X5只)", "2026-09-22"],
        ]
      );
    } else {
      downloadExcelTemplate(
        `${getTenant().storeLabel}订单导入模板.xlsx`,
        ["订单号", "门店名称", "公母", "规格", "只数", "要求发货日期"],
        [
          ["SO20260921008", `${getTenant().storeLabel}(深圳店)`, "公", "4.0两", 1500, "2026-09-22"],
          ["SO20260921009", `${getTenant().storeLabel}(广州店)`, "母", "3.0两", 800, "2026-09-22"],
        ]
      );
    }
  };

  const handleSubmit = () => {
    if (parsedPreview.length === 0) {
      toast.error("无可导入的有效订单数据");
      return;
    }

    startTransition(async () => {
      const res = await importOrdersAction(parsedPreview);
      if (res.success) {
        toast.success(res.message);
        setOpen(false);
        setInputText("");
        setFileName(null);
        setParsedPreview([]);
      } else {
        toast.error(res.message);
      }
    });
  };

  // 统计汇总
  const totalCrabs = parsedPreview.reduce((sum, item) => sum + item.count, 0);
  // ponytail: render limit to avoid huge DOM freeze on thousands of rows
  const displayPreview = parsedPreview.slice(0, 100);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 gap-1.5 bg-primary text-primary-foreground font-medium shadow-xs">
          <UploadCloud className="size-4" />
          Excel 批量导入订单
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <FileSpreadsheet className="size-5 text-primary" />
              发货订单批量导入与智能拆分
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <Download className="size-3.5" />
              下载标准模板
            </Button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            支持 Excel (.xlsx, .xls, .csv) 文件上传，自动解析订单与蟹卡多规格明细。
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const nextTab = v as "STORE" | "CARD";
            setActiveTab(nextTab);
            if (inputText.trim()) {
              parseText(inputText, nextTab);
            }
          }}
          className="flex-1 flex flex-col min-h-0 space-y-3"
        >
          <div className="flex items-center justify-between pb-1 border-b">
            <TabsList className="h-8">
              <TabsTrigger value="CARD" className="text-xs">
                蟹卡提货导入（自动拆分规格）
              </TabsTrigger>
              <TabsTrigger value="STORE" className="text-xs">
                {getTenant().storeLabel}订单导入
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 拖拽上传区域 */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFileUpload(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/40 transition-colors flex flex-col items-center justify-center gap-1.5 bg-muted/10"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
            />
            {fileName ? (
              <div className="flex items-center gap-2 text-xs font-medium text-primary">
                <FileCheck2 className="size-5" />
                <span>已选择文件：{fileName}</span>
                <span className="text-muted-foreground text-[11px]">（点击可更换文件）</span>
              </div>
            ) : (
              <>
                <UploadCloud className="size-7 text-muted-foreground" />
                <div className="text-xs text-foreground font-medium">
                  点击选择 或 拖拽 Excel 文件到此处
                </div>
                <div className="text-[11px] text-muted-foreground">
                  支持 .xlsx / .xls / .csv 格式，导入前可先下载上方标准模板
                </div>
              </>
            )}
          </div>

          {/* 备用纯文本直接粘贴展开项 */}
          <details className="text-[11px] text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground select-none">
              高级选项：直接粘贴 Excel 复制文本
            </summary>
            <Textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                parseText(e.target.value, activeTab);
              }}
              placeholder={
                activeTab === "CARD"
                  ? "支持直接粘贴 Excel 行（例如：订单号 日期 礼盒型号 规格详情 条码）"
                  : `格式：订单号 门店名称 公母 规格 只数 发货日期`
              }
              className="font-mono text-xs h-20 resize-none mt-2"
            />
          </details>

          {/* 解析预览与汇总看板（带最大高度约束与截断保护） */}
          <div className="flex-1 min-h-0 flex flex-col border rounded-lg overflow-hidden bg-muted/20">
            <div className="px-3 py-2 bg-muted/50 border-b flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  解析结果：共 {parsedPreview.length} 条需求明细
                </span>
                {parsedPreview.length > 0 && (
                  <Badge variant="secondary" className="text-[11px] font-mono">
                    合计 {totalCrabs.toLocaleString()} 只蟹
                  </Badge>
                )}
              </div>
              <Badge variant="outline" className="text-[10px]">
                {activeTab === "CARD" ? "蟹卡拆单模式" : "门店直发模式"}
              </Badge>
            </div>

            {/* 表格预览区（固定高度上限 max-h-56，内滚） */}
            <div className="flex-1 max-h-56 overflow-y-auto p-2 space-y-1">
              {parsedPreview.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
                  暂无解析数据，请上传 Excel 文件或粘贴订单内容
                </div>
              ) : (
                <>
                  {displayPreview.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded bg-background border text-xs hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-6 font-mono">{idx + 1}</span>
                        <span className="font-mono font-bold text-foreground">{item.orderNo}</span>
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {item.storeName}
                        </Badge>
                        {item.specModel && (
                          <span className="text-[11px] text-muted-foreground truncate max-w-[180px]" title={item.specModel}>
                            ({item.specModel})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-primary font-medium">
                          {item.gender === "FEMALE" ? "母蟹" : "公蟹"} {item.weightTier}
                        </span>
                        <span className="font-bold text-foreground">{item.count} 只</span>
                        <span className="text-[11px] text-muted-foreground">{item.deliveryDate}</span>
                      </div>
                    </div>
                  ))}
                  {parsedPreview.length > 100 && (
                    <div className="text-center py-2 text-[11px] text-muted-foreground bg-muted/40 rounded">
                      已展示前 100 条明细（其余 {parsedPreview.length - 100} 条格式正常），点击下方按钮即可一键全部导入。
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2 border-t mt-1">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending || parsedPreview.length === 0}
            className="gap-1.5 bg-primary text-primary-foreground font-medium"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            确认导入并写入需求 ({parsedPreview.length} 条)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
