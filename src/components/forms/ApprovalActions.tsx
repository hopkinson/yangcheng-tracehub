"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { approveTagClaimAction, approveOutboundOrderAction } from "@/actions/approvals";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";

interface ApprovalDialogProps {
  title: string;
  defaultApproveComment?: string;
  onConfirm: (approved: boolean, comment?: string) => Promise<void>;
}

export function ApprovalActionDialog({
  title,
  defaultApproveComment,
  onConfirm,
}: ApprovalDialogProps) {
  const [loading, setLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");

  async function handleQuickApprove() {
    setLoading(true);
    try {
      await onConfirm(true, defaultApproveComment || "审核通过，准予放行");
      toast.success(`${title}已一键通过放行`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "审批失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleRejectConfirm() {
    if (!comment.trim()) {
      toast.error("驳回审批必须填写审核意见/驳回原因！");
      return;
    }
    setLoading(true);
    try {
      await onConfirm(false, comment.trim());
      toast.success(`${title}已驳回`);
      setRejectOpen(false);
      setComment("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "驳回失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5 justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:border-emerald-500/50 h-7 text-xs font-medium px-2.5 shadow-none"
          onClick={handleQuickApprove}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
          ) : (
            <Check className="size-3.5" data-icon="inline-start" />
          )}
          通过
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={loading}
          className="h-7 text-xs px-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border/60"
          onClick={() => setRejectOpen(true)}
        >
          <X className="size-3.5" data-icon="inline-start" />
          驳回
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回{title}</DialogTitle>
            <DialogDescription>
              请填写驳回具体原因与整改意见（必填，将通知申请人并释放库存占用）
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-foreground">
                驳回意见与原因 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="请详细说明驳回原因（如：在池规格不符、冷库实存盘亏、单票数量不一致等）"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setRejectOpen(false)} disabled={loading}>
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRejectConfirm}
                disabled={loading}
              >
                {loading ? "处理中..." : "确认驳回"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TagApprovalButton({ claimId }: { claimId: string; qaUserId?: string }) {
  return (
    <ApprovalActionDialog
      title="蟹扣领用申请"
      defaultApproveComment="核验在池存活与额度余量充足，准予领用"
      onConfirm={async (approved, comment) => {
        await approveTagClaimAction({ claimId, approved, comment });
      }}
    />
  );
}

export function OutboundApprovalButton({ orderId }: { orderId: string; qaUserId?: string }) {
  return (
    <ApprovalActionDialog
      title="出库申请单"
      defaultApproveComment="单票核对一致，冷库规格库存与批次存活校验通过"
      onConfirm={async (approved, comment) => {
        await approveOutboundOrderAction({
          orderId,
          approved,
          comment: approved ? comment : undefined,
          rejectReason: !approved ? comment : undefined,
        });
      }}
    />
  );
}
