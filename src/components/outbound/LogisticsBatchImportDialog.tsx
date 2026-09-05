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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Truck, Loader2, Download, UploadCloud, FileCheck2 } from "lucide-react";
import { batchImportLogisticsAction, updateSingleLineLogisticsAction } from "@/actions/outbound";
import { readExcelFile, downloadExcelTemplate } from "@/lib/excel";

export function LogisticsBatchImportDialog({
  outboundId,
  outboundCode,
  lines = [],
  userId,
}: {
  outboundId: string;
  outboundCode: string;
  lines?: Array<{
    id: string;
    orderNo: string;
    gender: string;
    weightTier: string;
    count: number;
    expressCompany?: string | null;
    waybillNo?: string | null;
  }>;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"excel" | "manual">("excel");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    try {
      setFileName(file.name);
      const tsv = await readExcelFile(file);
      setRawText(tsv);
      toast.success(`文件 ${file.name} 已读取`);
    } catch {
      toast.error("Excel 文件读取失败，请检查格式");
    }
  };

  const handleExportTemplate = () => {
    const sampleRows = lines.length > 0
      ? lines.map((l) => [l.orderNo, l.expressCompany || "顺丰冷运", l.waybillNo || ""])
      : [["SO20260901001", "顺丰冷运", "SF1234567890"]];

    downloadExcelTemplate(
      `出库批次_${outboundCode}_物流回填表.xlsx`,
      ["订单号", "快递公司", "快递运单号"],
      sampleRows
    );
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) {
      toast.error("请先上传或粘贴物流运单明细");
      return;
    }

    const records = rawText
      .trim()
      .split("\n")
      .map((row) => row.split(/[\t,， ]+/).filter(Boolean))
      .filter((parts) => parts.length >= 2 && !/^(订单号|单号|序号|提货单号|发货单号|系统单号)/i.test(parts[0]))
      .map((parts) => ({
        orderNo: parts[0],
        expressCompany: parts.length === 2 ? "顺丰冷运" : parts[1],
        waybillNo: parts.length === 2 ? parts[1] : parts[2],
      }));

    if (records.length === 0) {
      toast.error("未能解析到有效的物流记录，请检查格式（订单号、运单号）");
      return;
    }

    startTransition(async () => {
      try {
        const res = await batchImportLogisticsAction({
          outboundOrderId: outboundId,
          records,
          operatorId: userId,
        });

        toast.success(res.message);
        setOpen(false);
      } catch (err: any) {
        toast.error(err.message || "批量回填物流失败");
      }
    });
  };

  const handleSingleSave = async (lineId: string, company: string, waybill: string) => {
    if (!waybill.trim()) {
      toast.error("运单号不能为空");
      return;
    }
    startTransition(async () => {
      try {
        await updateSingleLineLogisticsAction({
          lineId,
          expressCompany: company,
          waybillNo: waybill,
          operatorId: userId,
        });
        toast.success("单行物流单号已保存");
      } catch (err: any) {
        toast.error(err.message || "更新失败");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 px-1.5 text-[11px] text-primary gap-1">
          <Truck className="size-3" />
          回填物流
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Truck className="size-5 text-primary" />
              物流单号回填与导入
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTemplate}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <Download className="size-3.5" />
              导出待回填表格
            </Button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            出库批次：<span className="font-mono font-bold text-foreground">{outboundCode}</span> · 支持上传 Excel 回填或逐行维护。
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b pb-2 text-xs">
          <button
            type="button"
            onClick={() => setMode("excel")}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              mode === "excel" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            Excel 导入
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              mode === "manual" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            逐行手动修改 ({lines.length} 笔)
          </button>
        </div>

        {mode === "excel" ? (
          <form onSubmit={handleImport} className="space-y-3 py-1 flex-1 flex flex-col min-h-0">
            {/* 上传区域 */}
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
                  <span className="text-muted-foreground text-[11px]">（点击更换）</span>
                </div>
              ) : (
                <>
                  <UploadCloud className="size-6 text-muted-foreground" />
                  <div className="text-xs text-foreground font-medium">
                    点击选择 或 拖拽已填好运单号的 Excel 到此处
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    支持 .xlsx / .xls / .csv 格式（可先点击右上角导出待回填表格）
                  </div>
                </>
              )}
            </div>

            {/* 备用文本粘贴折叠区 */}
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground select-none">
                高级选项：直接粘贴文本
              </summary>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`KK20260920055\t顺丰冷链\tSF168899882201`}
                className="text-xs font-mono h-24 resize-none mt-1"
              />
            </details>

            <div className="flex justify-end gap-2 pt-2 border-t mt-auto">
              <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)} disabled={isPending}>
                取消
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending || !rawText.trim()}
                className="gap-1 bg-primary text-primary-foreground font-medium"
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                确认批量解析并回填
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2 py-1 flex-1 overflow-y-auto max-h-72 pr-1">
            {lines.map((l) => (
              <ManualLineRow key={l.id} line={l} onSave={handleSingleSave} isPending={isPending} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ManualLineRow({
  line,
  onSave,
  isPending,
}: {
  line: {
    id: string;
    orderNo: string;
    gender: string;
    weightTier: string;
    count: number;
    expressCompany?: string | null;
    waybillNo?: string | null;
  };
  onSave: (id: string, company: string, waybill: string) => void;
  isPending: boolean;
}) {
  const [company, setCompany] = useState(line.expressCompany || "顺丰冷运");
  const [waybill, setWaybill] = useState(line.waybillNo || "");

  return (
    <div className="flex items-center gap-2 p-2 rounded border bg-muted/10 text-xs">
      <div className="w-28 font-mono">
        <span className="font-bold text-foreground block">{line.orderNo}</span>
        <span className="text-[10px] text-muted-foreground">
          {line.gender === "FEMALE" ? "母" : "公"}
          {line.weightTier} · {line.count}只
        </span>
      </div>
      <Input
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="快递公司"
        className="h-7 text-xs w-28"
      />
      <Input
        value={waybill}
        onChange={(e) => setWaybill(e.target.value)}
        placeholder="输入快递运单号"
        className="h-7 text-xs flex-1 font-mono"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onSave(line.id, company, waybill)}
        disabled={isPending}
        className="h-7 text-[11px] px-2"
      >
        保存
      </Button>
    </div>
  );
}
