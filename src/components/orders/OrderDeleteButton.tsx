"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteOrderBatchAction } from "@/actions/production";
import { toast } from "sonner";

export function OrderDeleteButton({ importId, orderNo }: { importId: string; orderNo: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(`确认撤销并删除订单 ${orderNo} 吗？`)) return;

    startTransition(async () => {
      const res = await deleteOrderBatchAction(importId, orderNo);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={isPending}
      className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10"
      title="整单删除重导"
    >
      {isPending ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3 mr-1" />}
      撤销
    </Button>
  );
}
