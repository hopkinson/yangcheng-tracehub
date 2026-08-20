"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createBatchAction } from "@/actions/batches";
import { toast } from "sonner";
import { Plus, Waves } from "lucide-react";

export function BatchIntakeDialog({
  farmers,
  pools,
  userId,
}: {
  farmers: Array<{ id: string; name: string; code: string; enclosures: Array<{ id: string; code: string }> }>;
  pools: Array<{ id: string; name: string; code: string; currentGender: string | null; currentWeightTier: string | null }>;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedFarmerId, setSelectedFarmerId] = useState(farmers[0]?.id || "");
  const [selectedEnclosureId, setSelectedEnclosureId] = useState(farmers[0]?.enclosures[0]?.id || "");
  const [selectedPoolId, setSelectedPoolId] = useState(pools[0]?.id || "");
  const [gender, setGender] = useState("MALE");
  const [weightTier, setWeightTier] = useState("4.0两");
  const [inPoolCount, setInPoolCount] = useState("1000");

  const currentFarmer = farmers.find((f) => f.id === selectedFarmerId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const count = parseInt(inPoolCount, 10);
      if (isNaN(count) || count <= 0) throw new Error("请输入有效的入池数量");

      await createBatchAction({
        farmerId: selectedFarmerId,
        enclosureId: selectedEnclosureId,
        poolId: selectedPoolId,
        gender,
        weightTier,
        inPoolCount: count,
        createdById: userId,
      });

      toast.success("批次创建与入池登记成功！");
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "入池失败";
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
          原料入池登记 (创建批次)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Waves className="size-5 text-primary" />
            <DialogTitle>活蟹到厂入池登记</DialogTitle>
          </div>
          <DialogDescription>
            批次即入池，一批一公母一规格。系统将自动校验养殖户当年额度与池子在养规格。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>来源养殖户</Label>
            <Select
              value={selectedFarmerId}
              onValueChange={(val) => {
                setSelectedFarmerId(val);
                const f = farmers.find((item) => item.id === val);
                if (f && f.enclosures.length > 0) {
                  setSelectedEnclosureId(f.enclosures[0].id);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择养殖户" />
              </SelectTrigger>
              <SelectContent>
                {farmers.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.code} - {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>来源围网</Label>
            <Select value={selectedEnclosureId} onValueChange={setSelectedEnclosureId}>
              <SelectTrigger>
                <SelectValue placeholder="选择围网" />
              </SelectTrigger>
              <SelectContent>
                {currentFarmer?.enclosures.map((enc) => (
                  <SelectItem key={enc.id} value={enc.id}>
                    围网编号: {enc.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>存放暂养池 (按规格复用)</Label>
            <Select value={selectedPoolId} onValueChange={setSelectedPoolId}>
              <SelectTrigger>
                <SelectValue placeholder="选择暂养池" />
              </SelectTrigger>
              <SelectContent>
                {pools.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} - {p.name} {p.currentGender ? `(在养: ${p.currentGender === "MALE" ? "公" : "母"} ${p.currentWeightTier})` : "(空池)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>公母</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">公蟹</SelectItem>
                  <SelectItem value="FEMALE">母蟹</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>重量档位规格</Label>
              <Select value={weightTier} onValueChange={setWeightTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2.5两">2.5两</SelectItem>
                  <SelectItem value="3.0两">3.0两</SelectItem>
                  <SelectItem value="3.5两">3.5两</SelectItem>
                  <SelectItem value="4.0两">4.0两</SelectItem>
                  <SelectItem value="4.5两">4.5两</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>本次入池数量 (只)</Label>
            <Input
              type="number"
              value={inPoolCount}
              onChange={(e) => setInPoolCount(e.target.value)}
              min="1"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "登记中..." : "确认入池"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
