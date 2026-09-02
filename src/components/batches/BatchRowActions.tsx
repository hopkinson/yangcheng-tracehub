"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LossRegisterDialog } from "@/components/forms/LossRegisterDialog";
import { BatchDetailDialog } from "@/components/batches/BatchDetailDialog";
import { BatchFreezeButton } from "@/components/batches/BatchFreezeButton";
import { MoreHorizontal, FileText, ShieldAlert, ShieldCheck } from "lucide-react";

export function BatchRowActions({
  batch,
  userId,
  isWarehouseOrAdmin,
  isQaOrAdmin,
}: {
  batch: any;
  userId: string;
  isWarehouseOrAdmin: boolean;
  isQaOrAdmin: boolean;
}) {
  const isCompleted = batch.status === "COMPLETED";
  const isFrozen = batch.status === "FROZEN";

  return (
    <div className="flex items-center justify-end gap-1.5">
      {/* 1. 主操作：未出清时外露唯一的「盘点损耗」按钮 */}
      {!isCompleted && isWarehouseOrAdmin && (
        <LossRegisterDialog batch={batch} userId={userId} />
      )}

      {/* 2. 更多操作下拉菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">操作菜单</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          {/* 电子码单详情 */}
          <BatchDetailDialog
            batch={batch}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <FileText className="size-3.5 mr-2 text-primary" />
                <span>电子码单</span>
              </DropdownMenuItem>
            }
          />

          {/* 风控冻结 / 解冻 */}
          {!isCompleted && isQaOrAdmin && (
            <>
              <DropdownMenuSeparator />
              <BatchFreezeButton
                batchId={batch.id}
                batchCode={batch.code}
                isFrozen={isFrozen}
                userId={userId}
                trigger={
                  <DropdownMenuItem
                    variant={isFrozen ? "default" : "destructive"}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {isFrozen ? (
                      <>
                        <ShieldCheck className="size-3.5 mr-2 text-emerald-600" />
                        <span className="text-emerald-600">解除冻结</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="size-3.5 mr-2" />
                        <span>冻结批次</span>
                      </>
                    )}
                  </DropdownMenuItem>
                }
              />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
