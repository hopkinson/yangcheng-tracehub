"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { completeBundleBatchAction } from "@/actions/production";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

export function CompleteBundleButton({ bundleId, code }: { bundleId: string; code: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleComplete = () => {
    startTransition(async () => {
      const res = await completeBundleBatchAction(bundleId);
      if (res.success) {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="h-6 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
      >
        {isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle className="size-3" />}
        完成捆扎
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="确认完成捆扎作业"
        description={`确认完成批次【${code}】的捆扎作业吗？\n\n完成后作业状态将流转为已完成，方可进入分拣称重环节。`}
        confirmText="确认完成"
        variant="default"
        loading={isPending}
        onConfirm={handleComplete}
      />
    </>
  );
}
