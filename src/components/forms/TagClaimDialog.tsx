"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requestTagClaimAction } from "@/actions/tags";
import { toast } from "sonner";
import { Plus, Tag } from "lucide-react";

export function TagClaimDialog({
  farmers,
  userId,
}: {
  farmers: Array<{
    id: string;
    name: string;
    code: string;
    quota: number;
    activeInPool: number;
    claimedSoFar: number;
  }>;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFarmerId, setSelectedFarmerId] = useState(farmers[0]?.id || "");
  const [claimCount, setClaimCount] = useState("500");

  const currentFarmer = farmers.find((f) => f.id === selectedFarmerId);
  const remainingQuota = currentFarmer ? Math.max(0, currentFarmer.quota - currentFarmer.claimedSoFar) : 0;
  const maxClaimable = currentFarmer ? Math.min(currentFarmer.activeInPool, remainingQuota) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const count = parseInt(claimCount, 10);
      if (isNaN(count) || count <= 0) throw new Error("请输入有效的领扣数量");

      await requestTagClaimAction({
        farmerId: selectedFarmerId,
        claimCount: count,
        applicantId: userId,
      });

      toast.success("蟹扣领用申请提交成功，已进入品控审批流程！");
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "申请失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="size-4" data-icon="inline-start" />
          蟹扣领用申请
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Tag className="size-5 text-primary" />
            <DialogTitle>蟹扣领用申请 (按养殖户)</DialogTitle>
          </div>
          <DialogDescription>
            蟹扣为养殖户码（一户一码），不含批次号。系统实时展示该养殖户当前【可领余量】。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>选择来源养殖户</Label>
            <Select value={selectedFarmerId} onValueChange={setSelectedFarmerId}>
              <SelectTrigger>
                <SelectValue placeholder="选择养殖户" />
              </SelectTrigger>
              <SelectContent>
                {farmers.map((f) => {
                  const rem = Math.max(0, f.quota - f.claimedSoFar);
                  const maxAvail = Math.min(f.activeInPool, rem);
                  return (
                    <SelectItem key={f.id} value={f.id}>
                      {f.code} - {f.name} (可领余量: {maxAvail} 只)
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {currentFarmer && (
            <div className="rounded-lg border bg-muted/40 p-3 text-xs flex flex-col gap-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">年度签约额度:</span>
                <span>{currentFarmer.quota.toLocaleString()} 只</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">该户名下在池存活合计:</span>
                <span>{currentFarmer.activeInPool.toLocaleString()} 只</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">年度累计已核销蟹扣:</span>
                <span>{currentFarmer.claimedSoFar.toLocaleString()} 只</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold text-emerald-600">
                <span>当前最大可领扣余量:</span>
                <span className="text-sm">{maxClaimable.toLocaleString()} 只</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>本次领用数量 (只)</Label>
            <Input
              type="number"
              value={claimCount}
              onChange={(e) => setClaimCount(e.target.value)}
              min="1"
              max={maxClaimable}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading || maxClaimable <= 0}>
              {loading ? "提交中..." : "提交领用申请"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
