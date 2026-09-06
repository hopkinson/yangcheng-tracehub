"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteBundleBatchAction } from "@/actions/production";

export function CancelBundleButton({
  bundleId,
  code,
  status,
}: {
  bundleId: string;
  code: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await deleteBundleBatchAction(bundleId);
      if (res.success) {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  const isCompleted = status === "COMPLETED";

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-6 px-1.5 text-[11px] gap-1 text-muted-foreground hover:text-destructive transition-colors"
        title={isCompleted ? "撤销已完工捆扎并恢复暂养在池量" : "作废未完成捆扎批次"}
      >
        {isCompleted ? <RotateCcw className="size-3" /> : <Trash2 className="size-3" />}
        <span>{isCompleted ? "撤销" : "作废"}</span>
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={isCompleted ? "确认撤销该捆扎批次？" : "确认作废该捆扎批次？"}
        description={
          isCompleted
            ? `捆扎批次【${code}】已完工。\n撤销后该批次将彻底作废删除，且已扣减的暂养池在池活蟹数量将原数退回暂养池。\n（若已进入下游分拣流程则禁止撤销）`
            : `确定要作废捆扎中批次【${code}】吗？作废后无法恢复。`
        }
        confirmText={isCompleted ? "确认撤销并还库" : "确认作废"}
        variant="destructive"
        loading={isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
