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
import { Layers, Plus, Trash2, Loader2, Camera, Upload, X } from "lucide-react";
import { createMultiSpecBatchAction } from "@/actions/batches";
import { uploadFileAction } from "@/actions/upload";

export interface FarmerOption {
  id: string;
  name: string;
  code: string;
  quota: number;
  remainingQuota: number;
  status: string;
  enclosures: Array<{ id: string; code: string; description: string | null }>;
}

export interface PoolOption {
  id: string;
  code: string;
  name: string;
  currentGender: string | null;
  currentWeightTier: string | null;
  liveCount: number;
}

export function MultiSpecIntakeDialog({
  farmers,
  pools,
  userId,
}: {
  farmers: FarmerOption[];
  pools: PoolOption[];
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [selectedFarmerId, setSelectedFarmerId] = useState(farmers[0]?.id || "");
  const selectedFarmer = farmers.find((f) => f.id === selectedFarmerId);
  const selectedEnclosureId = selectedFarmer?.enclosures[0]?.id || "";

  // 码单头
  const [formNo, setFormNo] = useState("YCGF-PZZX-202603");
  const [temp, setTemp] = useState("18.5");
  const [humidity, setHumidity] = useState("85.0");
  const [escort, setEscort] = useState("孙师傅 (跟车员)");
  const [slipUrl, setSlipUrl] = useState<string>("");

  // 明细行 (默认匹配空暂养池)
  const emptyPools = pools.filter((p) => p.liveCount === 0);
  const [items, setItems] = useState<
    Array<{ poolId: string; gender: string; weightTier: string; weight: number; inPoolCount: number }>
  >([
    { poolId: emptyPools[0]?.id || "", gender: "MALE", weightTier: "4.0两", weight: 450.0, inPoolCount: 1500 },
    { poolId: emptyPools[1]?.id || "", gender: "FEMALE", weightTier: "3.5两", weight: 380.0, inPoolCount: 1500 },
  ]);

  const handleAddItem = () => {
    const usedPoolIds = new Set(items.map((it) => it.poolId));
    const nextEmptyPool = emptyPools.find((p) => !usedPoolIds.has(p.id));
    setItems([
      ...items,
      {
        poolId: nextEmptyPool?.id || "",
        gender: "MALE",
        weightTier: "3.5两",
        weight: 300.0,
        inPoolCount: 1000,
      },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: string, val: any) => {
    setItems(
      items.map((it, i) => (i === idx ? { ...it, [field]: val } : it))
    );
  };

  const totalCount = items.reduce((sum, it) => sum + (Number(it.inPoolCount) || 0), 0);
  const totalWeight = items.reduce((sum, it) => sum + (Number(it.weight) || 0), 0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("文件不能超过 10MB");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadFileAction(formData);
      setSlipUrl(res.url);
      toast.success(`码单照片已上传: ${res.name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "码单照片上传失败";
      toast.error(msg);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmerId || items.length === 0) {
      toast.error("请选择养殖户并添加至少一行有效明细");
      return;
    }
    if (selectedFarmer?.status !== "ACTIVE") {
      toast.error("暂停合作养殖户禁止入池登记！");
      return;
    }
    if (totalCount > (selectedFarmer?.remainingQuota || 0)) {
      toast.error(`超额拦截：本批合计 ${totalCount} 只，该户剩余额度仅剩 ${selectedFarmer?.remainingQuota || 0} 只`);
      return;
    }

    // 前端严格校验：所有明细行必须选择空池，且同单不得重复选池
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const p = pools.find((x) => x.id === it.poolId);
      if (p && p.liveCount > 0) {
        toast.error(`暂养池隔离拦截：${p.name || p.code} 当前已有在养存量（${p.liveCount} 只），必须选择空池！`);
        return;
      }
      for (let j = i + 1; j < items.length; j++) {
        if (items[j].poolId === it.poolId) {
          toast.error(`码单明细分配冲突：同一码单每行明细必须分配到不同的空暂养池（第 ${i + 1} 行与第 ${j + 1} 行重复）！`);
          return;
        }
      }
    }

    startTransition(async () => {
      try {
        const res = await createMultiSpecBatchAction({
          farmerId: selectedFarmerId,
          enclosureId: selectedEnclosureId,
          formNo,
          temp: parseFloat(temp) || 18.5,
          humidity: parseFloat(humidity) || 85.0,
          escort,
          slipUrl: slipUrl || undefined,
          slipName: `${formNo}_码单原件.jpg`,
          items,
          createdById: userId,
        });

        toast.success(`原料批次 ${res.code} 创建成功（一码单 ${items.length} 规格共 ${totalCount} 只入池）`);
        setOpen(false);
      } catch (err: any) {
        toast.error(err.message || "创建批次失败");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 gap-1.5 bg-primary text-primary-foreground font-medium shadow-xs">
          <Plus className="size-4" />
          一码单多规格入池 (YL)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Layers className="size-5 text-primary" />
            原料批次到货入池登记（一码单多规格主从录入）
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            一个到货批次对应一张入库码单，多规格逐行分配至独立的空暂养池（一池一批次物理隔离，只能选择空池）。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 flex-1 overflow-y-auto px-1 py-1">
          {/* 码单主信息 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-lg border bg-muted/20">
            <div className="space-y-1">
              <Label className="text-xs">供货养殖户 (JD)</Label>
              <Select value={selectedFarmerId} onValueChange={setSelectedFarmerId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="选择养殖户" />
                </SelectTrigger>
                <SelectContent>
                  {farmers.map((f) => (
                    <SelectItem key={f.id} value={f.id} disabled={f.status !== "ACTIVE"} className="text-xs">
                      {f.name} ({f.code}) · 余量 {f.remainingQuota}只 {f.status !== "ACTIVE" && "⚠️暂停合作"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">纸质入库码单表号</Label>
              <Input value={formNo} onChange={(e) => setFormNo(e.target.value)} className="h-8 text-xs font-mono" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">跟车押运员</Label>
              <Input value={escort} onChange={(e) => setEscort(e.target.value)} className="h-8 text-xs" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">车内温度 (℃)</Label>
              <Input type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} className="h-8 text-xs font-mono" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">车内湿度 (%)</Label>
              <Input type="number" step="0.1" value={humidity} onChange={(e) => setHumidity(e.target.value)} className="h-8 text-xs font-mono" />
            </div>

            <div className="space-y-1 flex flex-col justify-end">
              {slipUrl ? (
                <div className="flex items-center justify-between h-8 px-2 border rounded bg-background text-xs">
                  <div className="flex items-center gap-1 text-[11px] text-primary truncate">
                    <Camera className="size-3.5 shrink-0" />
                    <span>码单照片已上传</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setSlipUrl("")}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ) : (
                <label className="h-8 border border-dashed rounded flex items-center justify-center gap-1 px-2 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                  <Upload className="size-3.5" />
                  <span>上传码单照片</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>
          </div>

          {/* 明细行编辑 */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/10">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">码单多规格明细行（逐行选池）</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="h-7 text-xs gap-1">
                <Plus className="size-3" /> 添加明细行
              </Button>
            </div>

            <div className="space-y-2 pt-1">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 p-2 bg-background border rounded text-xs items-center">
                  <div className="col-span-2">
                    <Select value={item.gender} onValueChange={(v) => handleItemChange(idx, "gender", v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE" className="text-xs">公蟹</SelectItem>
                        <SelectItem value="FEMALE" className="text-xs">母蟹</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <Input
                      value={item.weightTier}
                      onChange={(e) => handleItemChange(idx, "weightTier", e.target.value)}
                      placeholder="如 4.0两"
                      className="h-7 text-xs font-mono"
                    />
                  </div>

                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={item.weight}
                      onChange={(e) => handleItemChange(idx, "weight", parseFloat(e.target.value) || 0)}
                      placeholder="重量(斤)"
                      className="h-7 text-xs font-mono text-right"
                    />
                  </div>

                  <div className="col-span-2">
                    <Input
                      type="number"
                      value={item.inPoolCount}
                      onChange={(e) => handleItemChange(idx, "inPoolCount", parseInt(e.target.value, 10) || 0)}
                      placeholder="只数"
                      className="h-7 text-xs font-mono text-right font-bold"
                    />
                  </div>

                  <div className="col-span-3">
                    <Select value={item.poolId} onValueChange={(v) => handleItemChange(idx, "poolId", v)}>
                      <SelectTrigger className="h-7 text-xs font-mono">
                        <SelectValue placeholder="选入池" />
                      </SelectTrigger>
                      <SelectContent>
                        {pools.map((p) => {
                          const isOccupied = p.liveCount > 0;
                          const otherRowConflict = items.some(
                            (other, oIdx) => oIdx !== idx && other.poolId === p.id
                          );
                          const isDisabled = isOccupied || otherRowConflict;

                          return (
                            <SelectItem key={p.id} value={p.id} disabled={isDisabled} className="text-xs font-mono">
                              {p.name || p.code} {isOccupied ? `(在养${p.liveCount}只 · 不可选)` : otherRowConflict ? "(本单已选 · 不可选)" : "(空池)"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-1 flex justify-end">
                    {items.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(idx)} className="h-7 px-1 text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex justify-between items-center pt-2 text-xs font-mono border-t">
                <span className="text-muted-foreground">
                  养殖户剩余额度：<strong className="text-foreground">{selectedFarmer?.remainingQuota || 0} 只</strong>
                </span>
                <span className="font-bold text-foreground">
                  本批合计：<strong className="text-primary text-sm">{totalCount} 只</strong> ({totalWeight} 斤)
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={isPending || items.length === 0} className="gap-1 bg-primary text-primary-foreground">
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              确认提交并入池 ({totalCount} 只)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
