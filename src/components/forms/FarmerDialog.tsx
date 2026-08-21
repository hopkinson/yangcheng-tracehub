"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createFarmerAction, updateFarmerAction } from "@/actions/farmers";
import { toast } from "sonner";
import { Plus, Edit2, Scale } from "lucide-react";

export function FarmerDialog({
  farmer,
  userId,
}: {
  farmer?: {
    id: string;
    code: string;
    name: string;
    phone: string;
    farmType: string;
    area: number;
    creditRating: string;
    status: string;
    enclosures: Array<{ id: string; code: string }>;
  };
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEditing = !!farmer;

  const [name, setName] = useState(farmer?.name || "");
  const [phone, setPhone] = useState(farmer?.phone || "");
  const [farmType, setFarmType] = useState(farmer?.farmType || "LAKE_CRAB");
  const [area, setArea] = useState(farmer?.area ? String(farmer.area) : "10");
  const [creditRating, setCreditRating] = useState(farmer?.creditRating || "A");
  const [status, setStatus] = useState(farmer?.status || "ACTIVE");
  const [enclosuresStr, setEnclosuresStr] = useState(
    farmer?.enclosures ? farmer.enclosures.map((e) => e.code).join(", ") : "W-01"
  );

  const numArea = parseFloat(area) || 0;
  const calculatedQuota = Math.round(numArea * 600);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || numArea <= 0) {
      toast.error("请完整填写养殖户姓名、电话及有效养殖面积");
      return;
    }

    const enclosureCodes = enclosuresStr
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (enclosureCodes.length === 0) {
      toast.error("请至少填写一个围网编号");
      return;
    }

    setLoading(true);
    try {
      if (isEditing && farmer) {
        await updateFarmerAction({
          id: farmer.id,
          name,
          phone,
          farmType,
          area: numArea,
          creditRating,
          status,
          enclosureCodes,
          userId,
        });
        toast.success("养殖户档案及额度更新成功！");
      } else {
        await createFarmerAction({
          name,
          phone,
          farmType,
          area: numArea,
          creditRating,
          enclosureCodes,
          userId,
        });
        toast.success("签约养殖户建档成功！");
        setName("");
        setPhone("");
      }
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
            <Edit2 className="size-3.5" />
          </Button>
        ) : (
          <Button className="flex items-center gap-2">
            <Plus className="size-4" data-icon="inline-start" />
            新增签约养殖户
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            <DialogTitle>{isEditing ? `编辑养殖户档案 (${farmer.code})` : "新增签约养殖户与额度核定"}</DialogTitle>
          </div>
          <DialogDescription>
            蟹扣额度 = 养殖面积 × 600 只/亩，按自然年度核定，作为入池与领扣上限。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>养殖户姓名</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：张建国"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>联系电话</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="如：13812345678"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>养殖类型</Label>
              <Select value={farmType} onValueChange={setFarmType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LAKE_CRAB">湖蟹 (阳澄湖核心围网)</SelectItem>
                  <SelectItem value="POND_CRAB">塘蟹 (标准化生态塘)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>信用等级</Label>
              <Select value={creditRating} onValueChange={setCreditRating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A级 (连续3年无异常)</SelectItem>
                  <SelectItem value="B">B级 (1-2年或轻微违约)</SelectItem>
                  <SelectItem value="C">C级 (新户或曾有违约)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>养殖面积 (亩)</Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              required
            />
          </div>

          {/* 实时额度核算提示框 */}
          <div className="rounded-md border bg-primary/5 p-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">系统实时核定年度总额度:</span>
            <span className="font-mono font-bold text-lg text-primary">
              {calculatedQuota.toLocaleString()} 只
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>名下围网水域编号 (逗号分隔)</Label>
            <Input
              value={enclosuresStr}
              onChange={(e) => setEnclosuresStr(e.target.value)}
              placeholder="如：W-01, W-02"
              required
            />
          </div>

          {isEditing && (
            <div className="flex flex-col gap-1.5">
              <Label>合作状态</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">正常合作</SelectItem>
                  <SelectItem value="SUSPENDED">暂停供应</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "保存中..." : "确认保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
