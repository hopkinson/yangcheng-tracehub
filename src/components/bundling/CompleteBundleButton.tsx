"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { completeBundleBatchAction } from "@/actions/production";
import { toast } from "sonner";

export function CompleteBundleButton({ bundleId, code }: { bundleId: string; code: string }) {
  const [isPending, startTransition] = useTransition();

  const handleComplete = () => {
    if (!confirm(`确认完成批次 ${code} 的捆扎作业吗？完成后方可进入分拣称重。`)) return;

    startTransition(async () => {
      const res = await completeBundleBatchAction(bundleId);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleComplete}
      disabled={isPending}
      className="h-6 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
    >
      {isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle className="size-3" />}
      完成捆扎
    </Button>
  );
}
