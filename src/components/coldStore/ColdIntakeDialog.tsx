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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThermometerSnowflake, Plus, Loader2 } from "lucide-react";
import { createColdIntakeAction } from "@/actions/production";

export interface ColdStoreOption {
  id: string;
  code: string;
  name: string;
  targetTemp: number;
}

export function ColdIntakeDialog({
  stores,
  defaultStoreId,
  trigger,
}: {
  stores: ColdStoreOption[];
  defaultStoreId?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [storeId, setStoreId] = useState(defaultStoreId || stores[0]?.id || "");
  const [count, setCount] = useState<number>(500);
  const [refId, setRefId] = useState("");
  const [operator, setOperator] = useState("李仓管");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || count <= 0) {
      toast.error("请选择保鲜库并输入有效的入库数量");
      return;
    }

    startTransition(async () => {
      const res = await createColdIntakeAction({
        storeId: currentStoreId,
        count,
        refType: "SORT",
        refId: refId.trim() || undefined,
        operator,
      });

      if (res.success) {
        toast.success(res.message);
        setOpen(false);
        setRefId("");
      } else {
        toast.error(res.message);
      }
    });
  };

  const currentStoreId = defaultStoreId || storeId || stores[0]?.id || "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="h-9 gap-1.5 bg-primary text-primary-foreground font-medium shadow-xs">
            <Plus className="size-4" />
            保鲜入库登记 (CR)
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <ThermometerSnowflake className="size-5 text-primary" />
            成品大闸蟹保鲜预冷入库登记
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            保鲜库【只入不出】，出库发货统一经由「出库管理」审批出库。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">目标保鲜库</Label>
            <Select value={currentStoreId} onValueChange={setStoreId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="选择保鲜库" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name} ({s.code}) · 目标 {s.targetTemp}℃
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">入库只数 (只)</Label>
            <Input
              type="number"
              min={1}
              value={count || ""}
              onChange={(e) => setCount(parseInt(e.target.value, 10) || 0)}
              className="h-9 text-sm font-mono text-right font-bold"
              placeholder="请输入入库数量"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              关联作业批次 / 任务号 <span className="text-[11px] text-muted-foreground">(选填，如 KZD... / FJR...)</span>
            </Label>
            <Input
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
              placeholder="例如：FJR2026092101"
              className="h-9 text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">操作经手人</Label>
            <Input
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || count <= 0}
              className="gap-1.5 bg-primary text-primary-foreground font-medium"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              确认登记入库 ({count} 只)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
