"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteOrderBatchAction } from "@/actions/production";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

export function OrderDeleteButton({ importId, orderNo }: { importId: string; orderNo: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteOrderBatchAction(importId, orderNo);
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
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10"
        title="整单删除重导"
      >
        <Trash2 className="size-3 mr-1" />
        撤销
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="确认撤销订单"
        description={`确定要撤销并删除订单【${orderNo}】吗？\n\n删除后该订单明细将被清空，需重新导入。`}
        confirmText="确认撤销"
        loading={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
