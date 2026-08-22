"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { approveTagClaimAction, approveOutboundOrderAction } from "@/actions/approvals";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

interface ApprovalDialogProps {
  title: string;
  approvePlaceholder?: string;
  onConfirm: (approved: boolean, comment?: string) => Promise<void>;
}

export function ApprovalActionDialog({
  title,
  approvePlaceholder = "审核意见 (选填)",
  onConfirm,
}: ApprovalDialogProps) {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [comment, setComment] = useState("");

  async function handleConfirm() {
    if (actionType === "REJECT" && !comment.trim()) {
      toast.error("驳回审批必须填写原因！");
      return;
    }
    setLoading(true);
    try {
      await onConfirm(actionType === "APPROVE", comment.trim() || undefined);
      toast.success(actionType === "APPROVE" ? `${title}已通过` : `${title}已驳回`);
      setDialogOpen(false);
      setComment("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "操作失败");
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
          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:border-emerald-500/50 h-7 text-xs font-medium px-2.5 shadow-none"
          onClick={() => {
            setActionType("APPROVE");
            setDialogOpen(true);
          }}
        >
          <Check className="size-3.5" data-icon="inline-start" />
          通过
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border/60"
          onClick={() => {
            setActionType("REJECT");
            setDialogOpen(true);
          }}
        >
          <X className="size-3.5" data-icon="inline-start" />
          驳回
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === "APPROVE" ? `审批通过${title}` : `驳回${title}`}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>{actionType === "APPROVE" ? "审核意见 (选填)" : "驳回原因 (必填)"}</Label>
              <Textarea
                placeholder={actionType === "APPROVE" ? approvePlaceholder : "请说明驳回具体原因"}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required={actionType === "REJECT"}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button
                variant={actionType === "APPROVE" ? "default" : "destructive"}
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? "处理中..." : "确认"}
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
      approvePlaceholder="核验额度与在池存活一致"
      onConfirm={async (approved, comment) => {
        await approveTagClaimAction({ claimId, approved, comment });
      }}
    />
  );
}

export function OutboundApprovalButton({ orderId }: { orderId: string; qaUserId?: string }) {
  return (
    <ApprovalActionDialog
      title="出库发货单"
      approvePlaceholder="单票核对一致，在池存活充足"
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
