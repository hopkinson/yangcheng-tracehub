"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toggleBatchFreezeAction } from "@/actions/batches";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck } from "lucide-react";

export function BatchFreezeButton({
  batchId,
  batchCode,
  isFrozen,
  userId,
}: {
  batchId: string;
  batchCode: string;
  isFrozen: boolean;
  userId: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    const actionName = isFrozen ? "解冻" : "冻结";
    const reason = !isFrozen ? prompt(`请输入冻结批次【${batchCode}】的争议/异常原因：`, "损耗超标/抽检待核实") : undefined;
    if (!isFrozen && reason === null) return;

    setLoading(true);
    try {
      await toggleBatchFreezeAction({
        batchId,
        freeze: !isFrozen,
        reason: reason || undefined,
        userId,
      });
      toast.success(`批次【${batchCode}】已成功${actionName}！`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `${actionName}失败`;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={isFrozen ? "default" : "outline"}
      size="sm"
      className={isFrozen ? "h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" : "h-7 text-xs gap-1 text-destructive hover:bg-destructive/10"}
      disabled={loading}
      onClick={handleToggle}
    >
      {isFrozen ? (
        <>
          <ShieldCheck className="size-3" />
          解冻批次
        </>
      ) : (
        <>
          <ShieldAlert className="size-3" />
          冻结批次
        </>
      )}
    </Button>
  );
}
