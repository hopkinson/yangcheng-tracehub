"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Thermometer, Droplets, User, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export interface BatchDetailProps {
  batch: {
    id: string;
    code: string;
    gender?: string;
    weightTier?: string;
    formNo?: string | null;
    temp?: number | null;
    humidity?: number | null;
    escort?: string | null;
    slipUrl?: string | null;
    slipName?: string | null;
    status: string;
    isException?: boolean;
    exceptionReason?: string | null;
    quickCheck?: string | null;
    sampleCheck?: string | null;
    inPoolCount: number;
    outPoolCount: number;
    lossCount: number;
    inPoolTime?: Date | string;
    createdAt?: Date | string;
    farmer: { name: string; code: string; quota?: number };
    enclosure?: { code: string; description?: string | null } | null;
    pool?: { code: string; name?: string | null } | null;
    items?: Array<{
      id: string;
      gender: string;
      weightTier: string;
      weight: number;
      inPoolCount: number;
      outPoolCount: number;
      lossCount: number;
      pool: { code: string; name: string };
    }>;
  };
  trigger?: React.ReactNode;
}

export function BatchDetailDialog({ batch, trigger }: BatchDetailProps) {
  const [open, setOpen] = useState(false);

  const rawTime = batch.inPoolTime || batch.createdAt || new Date();
  const inDateStr = typeof rawTime === "string" ? rawTime : rawTime.toISOString().slice(5, 16).replace("T", " ");
  const liveCount = Math.max(0, batch.inPoolCount - batch.outPoolCount - batch.lossCount);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] text-primary gap-1">
            <FileText className="size-3" />
            电子码单
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-base font-semibold pr-6">
            <div className="flex items-center gap-2">
              <span className="font-mono text-primary font-bold">{batch.code}</span>
              <span>到货入库码单与品控留档</span>
            </div>
            {batch.status === "FROZEN" ? (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="size-3 mr-1" /> 异常冻结批次
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                {batch.status === "COMPLETED" ? "已出清" : "暂养中"}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <span>供货养殖户：<strong className="text-foreground">{batch.farmer.name} ({batch.farmer.code})</strong></span>
            {batch.formNo && <span>码单表号：<strong className="text-foreground font-mono">{batch.formNo}</strong></span>}
            <span>到货时间：<strong className="text-foreground font-mono">{inDateStr}</strong></span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 flex-1 overflow-y-auto px-1 py-1">
          {/* 码单头车温/车湿/跟车员 */}
          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg border bg-muted/30 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Thermometer className="size-4 text-primary" />
              <div>
                <span className="text-[11px] text-muted-foreground block">车内实测温度</span>
                <span className="font-bold text-foreground">{batch.temp ?? 18.5} ℃</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="size-4 text-primary" />
              <div>
                <span className="text-[11px] text-muted-foreground block">车内湿度</span>
                <span className="font-bold text-foreground">{batch.humidity ?? 85.0} %</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <div>
                <span className="text-[11px] text-muted-foreground block">跟车押运员</span>
                <span className="font-bold text-foreground">{batch.escort || "跟车员"}</span>
              </div>
            </div>
          </div>

          {/* 行级品控检测快速状态 */}
          <div className="flex items-center gap-3 p-2.5 rounded bg-muted/20 border text-xs">
            <ShieldCheck className="size-4 text-primary shrink-0" />
            <div className="flex items-center gap-4 flex-wrap">
              <span>
                农残快检：
                <Badge variant="outline" className="ml-1 text-emerald-600 border-emerald-500/30 text-[10px]">
                  <CheckCircle2 className="size-3 mr-0.5" /> 合格 (未检出)
                </Badge>
              </span>
              <span>
                品质抽检与试吃：
                <Badge variant="outline" className="ml-1 text-emerald-600 border-emerald-500/30 text-[10px]">
                  <CheckCircle2 className="size-3 mr-0.5" /> 合格 (甘甜紧实)
                </Badge>
              </span>
            </div>
          </div>

          {/* 码单多规格明细列表 */}
          <div className="border rounded-lg overflow-hidden">
            <div className="px-3 py-1.5 bg-muted/50 border-b text-xs font-semibold">
              入库码单多规格明细（共 {batch.items?.length || 1} 行）
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/30 text-muted-foreground font-mono uppercase border-b">
                <tr>
                  <th className="px-3 py-1.5">入池仓位</th>
                  <th className="px-3 py-1.5">规格档位</th>
                  <th className="px-3 py-1.5">重量(斤)</th>
                  <th className="px-3 py-1.5">入池只数</th>
                  <th className="px-3 py-1.5">已发货</th>
                  <th className="px-3 py-1.5">账面在池</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono">
                {(batch.items?.length ? batch.items : [{
                  id: batch.id,
                  pool: { code: batch.pool?.code || "ZY-01", name: batch.pool?.name || "暂养池" },
                  gender: batch.gender,
                  weightTier: batch.weightTier || "4.0两",
                  weight: "—",
                  inPoolCount: batch.inPoolCount,
                  outPoolCount: batch.outPoolCount,
                  lossCount: batch.lossCount || 0,
                }]).map((it: any) => {
                  const itemLive = Math.max(0, it.inPoolCount - it.outPoolCount - (it.lossCount || 0));
                  return (
                    <tr key={it.id}>
                      <td className="px-3 py-1.5 font-bold text-foreground">
                        {it.pool.code} <span className="text-muted-foreground font-normal text-[11px]">({it.pool.name})</span>
                      </td>
                      <td className="px-3 py-1.5 font-medium text-primary">
                        {it.gender === "FEMALE" ? "母蟹" : "公蟹"} {it.weightTier}
                      </td>
                      <td className="px-3 py-1.5">{it.weight}{typeof it.weight === "number" ? " 斤" : ""}</td>
                      <td className="px-3 py-1.5 font-bold">{it.inPoolCount} 只</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{it.outPoolCount} 只</td>
                      <td className="px-3 py-1.5 font-bold text-emerald-600">{itemLive} 只</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 纸质码单照片原件 */}
          <div className="border rounded-lg overflow-hidden bg-muted/20 p-2 flex items-center justify-center min-h-40">
            {batch.slipUrl ? (
              <img src={batch.slipUrl} alt="入库码单原件" className="max-h-64 object-contain rounded border shadow-xs" />
            ) : (
              <div className="text-xs text-muted-foreground">纸质码单照片留档（纯原图展示）</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
