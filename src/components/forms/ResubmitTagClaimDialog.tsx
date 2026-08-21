"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resubmitTagClaimAction } from "@/actions/tags";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

export function ResubmitTagClaimDialog({
  claim,
  userId,
}: {
  claim: {
    id: string;
    claimCount: number;
    farmer: { name: string; code: string };
    approvalComment?: string | null;
  };
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [claimCount, setClaimCount] = useState(String(claim.claimCount));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const count = parseInt(claimCount, 10);
    if (isNaN(count) || count <= 0) {
      toast.error("请输入有效的领扣数量");
      return;
    }

    setLoading(true);
    try {
      await resubmitTagClaimAction({
        claimId: claim.id,
        claimCount: count,
        applicantId: userId,
      });
      toast.success("已重新提交领用申请，请等待品控审批！");
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "重新提交失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-primary">
          <RefreshCw className="size-3" />
          修改重提
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>修改并重新提交蟹扣申请</DialogTitle>
          <DialogDescription>
            来源养殖户：{claim.farmer.name} ({claim.farmer.code})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          {claim.approvalComment && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              <span className="font-semibold">此前品控驳回原因：</span> {claim.approvalComment}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>修正领用数量 (只)</Label>
            <Input
              type="number"
              min="1"
              value={claimCount}
              onChange={(e) => setClaimCount(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "提交中..." : "重新提报"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
