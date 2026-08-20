"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { approveTagClaimAction, approveOutboundOrderAction } from "@/actions/approvals";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

export function TagApprovalButton({
  claimId,
  qaUserId,
}: {
  claimId: string;
  qaUserId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [comment, setComment] = useState("");

  async function handleConfirm() {
    setLoading(true);
    try {
      if (actionType === "REJECT" && !comment.trim()) {
        throw new Error("驳回审批必须填写原因！");
      }

      await approveTagClaimAction({
        claimId,
        approverId: qaUserId,
        approved: actionType === "APPROVE",
        comment: comment.trim(),
      });

      toast.success(actionType === "APPROVE" ? "蟹扣领用审批已通过！" : "蟹扣领用申请已驳回！");
      setDialogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
          onClick={() => {
            setActionType("APPROVE");
            setDialogOpen(true);
          }}
        >
          <Check className="size-3" data-icon="inline-start" />
          通过
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 text-xs"
          onClick={() => {
            setActionType("REJECT");
            setDialogOpen(true);
          }}
        >
          <X className="size-3" data-icon="inline-start" />
          驳回
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{actionType === "APPROVE" ? "审批通过蟹扣领用" : "驳回蟹扣领用申请"}</DialogTitle>
            <DialogDescription>
              {actionType === "APPROVE"
                ? "通过后系统将扣减该养殖户名下可领余量并允许现场绑扣发运。"
                : "驳回后申请人可根据驳回意见修改后重新提交。"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>{actionType === "APPROVE" ? "审核意见 (选填)" : "驳回原因 (必填)"}</Label>
              <Textarea
                placeholder={actionType === "APPROVE" ? "核验额度与在池存活一致" : "请说明驳回具体原因"}
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

export function OutboundApprovalButton({
  orderId,
  qaUserId,
}: {
  orderId: string;
  qaUserId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [comment, setComment] = useState("");

  async function handleConfirm() {
    setLoading(true);
    try {
      if (actionType === "REJECT" && !comment.trim()) {
        throw new Error("驳回出库必须填写驳回原因！");
      }

      await approveOutboundOrderAction({
        orderId,
        approverId: qaUserId,
        approved: actionType === "APPROVE",
        comment: actionType === "APPROVE" ? comment.trim() : undefined,
        rejectReason: actionType === "REJECT" ? comment.trim() : undefined,
      });

      toast.success(actionType === "APPROVE" ? "出库审批通过，已扣减在池存活！" : "出库申请已驳回！");
      setDialogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
          onClick={() => {
            setActionType("APPROVE");
            setDialogOpen(true);
          }}
        >
          <Check className="size-3" data-icon="inline-start" />
          通过
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 text-xs"
          onClick={() => {
            setActionType("REJECT");
            setDialogOpen(true);
          }}
        >
          <X className="size-3" data-icon="inline-start" />
          驳回
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{actionType === "APPROVE" ? "审批通过出库单" : "驳回出库发货申请"}</DialogTitle>
            <DialogDescription>
              {actionType === "APPROVE"
                ? "系统将强校验批次在池存活并执行库存扣减，若池内清空将自动释放暂养池规格锁定。"
                : "请填写驳回原因留痕备查。"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>{actionType === "APPROVE" ? "审核批注 (选填)" : "驳回原因 (必填)"}</Label>
              <Textarea
                placeholder={actionType === "APPROVE" ? "单票核对一致，在池存活充足" : "请说明驳回具体原因"}
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
