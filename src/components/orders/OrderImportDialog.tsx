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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, UploadCloud, Loader2, Info } from "lucide-react";
import { importOrdersAction, RawImportOrder } from "@/actions/production";
import { Invariants } from "@/lib/invariants";

export function OrderImportDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"STORE" | "CARD">("CARD");
  
  // 文本录入 / 导入源
  const [inputText, setInputText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<RawImportOrder[]>([]);

  const parseText = (text: string, type: "STORE" | "CARD") => {
    const lines = text.trim().split("\n");
    const list: RawImportOrder[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(/[\t,，\s]+/);

      if (type === "CARD") {
        // 格式: 订单号 规格型号 发货日期
        const orderNo = parts[0] || `KK${Date.now()}`;
        const specModel = parts[1] || "";
        const deliveryDate = parts[2] || "2026-09-22";

        // 拆分
        const items = Invariants.parseCrabCardSpec(specModel);
        if (items.length > 0) {
          items.forEach((it) => {
            list.push({
              orderNo,
              type: "CRAB_CARD",
              storeName: "蟹卡提货",
              specModel,
              gender: it.gender,
              weightTier: it.weightTier,
              count: it.count,
              deliveryDate,
            });
          });
        } else {
          list.push({
            orderNo,
            type: "CRAB_CARD",
            storeName: "蟹卡提货",
            specModel,
            gender: "FEMALE",
            weightTier: "3.5两",
            count: 10,
            deliveryDate,
          });
        }
      } else {
        // 格式: 订单号 门店名称 公母 规格 只数 发货日期
        list.push({
          orderNo: parts[0] || `SM${Date.now()}`,
          type: "STORE_ORDER",
          storeName: parts[1] || "山姆会员店",
          gender: parts[2] === "母" ? "FEMALE" : "MALE",
          weightTier: parts[3] || "4.0两",
          count: parseInt(parts[4], 10) || 100,
          deliveryDate: parts[5] || "2026-09-22",
        });
      }
    }

    setParsedPreview(list);
  };

  const handleTextChange = (val: string) => {
    setInputText(val);
    parseText(val, activeTab);
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
        setParsedPreview([]);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 gap-1.5 bg-primary text-primary-foreground font-medium shadow-xs">
          <UploadCloud className="size-4" />
          Excel 批量导入订单
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <FileSpreadsheet className="size-5 text-primary" />
            发货订单批量导入与智能拆分
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            支持门店订单直接导入与蟹卡提货规格型号（如“4.0母蟹X5只，5.0公蟹X5只”）自动拆解为多行子需求明细。
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
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="flex items-center justify-between pb-2 border-b">
            <TabsList className="h-8">
              <TabsTrigger value="CARD" className="text-xs">
                蟹卡提货导入（自动拆分规格）
              </TabsTrigger>
              <TabsTrigger value="STORE" className="text-xs">
                山姆门店订单导入
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="my-3 space-y-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="size-3.5" />
              粘贴 Excel 复制的内容（Tab / 空格分隔每列）：
            </div>
            <Textarea
              value={inputText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={
                activeTab === "CARD"
                  ? "格式：订单号 规格型号 发货日期（例如：KK20260921102 4.0母蟹X5只，5.0公蟹X5只 2026-09-22）"
                  : "格式：订单号 门店名称 公母 规格 只数 发货日期（例如：SM20260921008 山姆会员店(深圳龙华店) 公 4.0两 1500 2026-09-22）"
              }
              className="font-mono text-xs h-24 resize-none"
            />
          </div>

          {/* 解析预览 */}
          <div className="flex-1 min-h-0 flex flex-col border rounded-lg overflow-hidden bg-muted/20">
            <div className="px-3 py-1.5 bg-muted/50 border-b flex items-center justify-between text-xs font-medium">
              <span>解析结果预览（共拆分出 {parsedPreview.length} 条需求明细）</span>
              <Badge variant="outline" className="text-[10px]">
                {activeTab === "CARD" ? "蟹卡拆单模式" : "门店模式"}
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {parsedPreview.length === 0 ? (
                <div className="h-28 flex items-center justify-center text-xs text-muted-foreground">
                  暂无解析数据，请在上方输入或粘贴订单数据
                </div>
              ) : (
                parsedPreview.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded bg-background border text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">{item.orderNo}</span>
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {item.type === "CRAB_CARD" ? "蟹卡提货" : item.storeName}
                      </Badge>
                      {item.specModel && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-[200px]" title={item.specModel}>
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
                ))
              )}
            </div>
          </div>
        </Tabs>

        <div className="flex justify-end gap-2 pt-3 border-t mt-2">
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
