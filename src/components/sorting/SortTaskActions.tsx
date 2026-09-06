"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CompleteSortDialog } from "@/components/sorting/CompleteSortDialog";
import { deleteSortTaskAction } from "@/actions/production";
import { RotateCcw, Trash2 } from "lucide-react";

export function SortTaskActions({
  taskId,
  code,
  status,
  inputCount,
  spec,
  gender,
}: {
  taskId: string;
  code: string;
  status: string;
  inputCount: number;
  spec: string;
  gender: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteSortTaskAction(taskId);
      if (res.success) {
        toast.success(res.message);
        setConfirmOpen(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      {status === "PENDING" ? (
        <>
          <CompleteSortDialog
            taskId={taskId}
            code={code}
            inputCount={inputCount}
            spec={spec}
            gender={gender}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-muted-foreground hover:text-destructive text-[11px]"
            onClick={() => setConfirmOpen(true)}
            title="取消分拣任务"
          >
            <Trash2 className="size-3" />
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-destructive hover:border-destructive/40"
          onClick={() => setConfirmOpen(true)}
          title="撤回已分拣结果"
        >
          <RotateCcw className="size-3" />
          撤回
        </Button>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={status === "PENDING" ? "取消分拣任务" : "撤回已完成分拣"}
        description={
          status === "PENDING"
            ? `确定取消分拣任务 ${code} 吗？`
            : `确定撤回分拣任务 ${code} 吗？\n撤回后该任务的分拣结果将被清除，关联未出库的冷库记录将一并清理。`
        }
        confirmText={status === "PENDING" ? "确认取消" : "确认撤回"}
        loading={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
