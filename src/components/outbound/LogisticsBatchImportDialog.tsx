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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Truck, Loader2, Edit3 } from "lucide-react";
import { batchImportLogisticsAction, updateSingleLineLogisticsAction } from "@/actions/outbound";

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

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) {
      toast.error("请粘贴或输入物流运单明细");
      return;
    }

    const records = rawText
      .trim()
      .split("\n")
      .map((row) => row.split(/[\t,， ]+/).filter(Boolean))
      .filter((parts) => parts.length >= 2)
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
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Truck className="size-5 text-primary" />
            物流单号回填与导入
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            出库批次：<span className="font-mono font-bold text-foreground">{outboundCode}</span> · 支持 Excel 复制批量导入或逐行维护。
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
            Excel 批量导入
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
          <form onSubmit={handleImport} className="space-y-3 py-1 flex-1 overflow-y-auto">
            <div className="space-y-1">
              <Label className="text-xs">Excel 物流明细粘贴（订单号 快递公司 运单号）</Label>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`KK20260920055\t顺丰冷链\tSF168899882201\nKK20260919018\t顺丰冷链\tSF10982310891`}
                className="text-xs font-mono h-36 resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                支持直接从 Excel 表格中复制包含「原始订单号、快递服务商、运单号」的整列数据并粘贴于此。
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)} disabled={isPending}>
                取消
              </Button>
              <Button type="submit" size="sm" disabled={isPending || !rawText.trim()} className="gap-1 bg-primary text-primary-foreground font-medium">
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
  const [company, setCompany] = useState(line.expressCompany || "顺丰冷链");
  const [waybill, setWaybill] = useState(line.waybillNo || "");

  return (
    <div className="flex items-center gap-2 p-2 rounded border bg-muted/10 text-xs">
      <div className="w-28 font-mono">
        <span className="font-bold text-foreground block">{line.orderNo}</span>
        <span className="text-[10px] text-muted-foreground">{line.gender === "FEMALE" ? "母" : "公"}{line.weightTier} · {line.count}只</span>
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
