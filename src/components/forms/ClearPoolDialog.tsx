"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearPoolAction } from "@/actions/pools";
import { toast } from "sonner";
import { Sparkles, AlertCircle, Loader2 } from "lucide-react";

export function ClearPoolDialog({
  pool,
  totalLive,
  userId,
}: {
  pool: { id: string; code: string; name: string; currentGender: string | null; currentWeightTier: string | null };
  totalLive: number;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("批次发货完毕，清池盘点结算归零，释放池位");

  async function handleClear() {
    if (!reason.trim()) return toast.error("请填写清池盘点说明");
    setLoading(true);
    toast.promise(
      clearPoolAction({ poolId: pool.id, reason: reason.trim(), userId }),
      {
        loading: "正在清池并解绑规格...",
        success: (res) => {
          setOpen(false);
          return `清池成功！已结算在池活蟹 ${res.clearedCrabs} 只，规格已释放！`;
        },
        error: (err) => err?.message || "清池失败",
        finally: () => setLoading(false),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 text-[11px] px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 border-amber-500/30">
          <Sparkles className="size-3 mr-1" />
          清池释放
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-400">
            <AlertCircle className="size-5" />
            清池盘点与规格解绑确认
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            对暂养池【{pool.name} ({pool.code})】进行清池结算。操作后在池残存将以盘点损耗结算归零，并解绑规格锁定。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2 text-xs">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex flex-col gap-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">当前锁定规格:</span>
              <span className="font-semibold text-foreground">
                {pool.currentGender === "MALE" ? "公蟹" : "母蟹"} · {pool.currentWeightTier}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">账面残存在池:</span>
              <span className="font-bold font-mono text-destructive">{totalLive.toLocaleString()} 只</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">清池结算原因 / 说明</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="请输入清池结算原因..." className="text-xs" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>取消</Button>
          <Button variant="default" size="sm" onClick={handleClear} disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
            {loading && <Loader2 className="size-3.5 animate-spin mr-1" />}
            确认清池并释放规格
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
