"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BatchDetailDialog } from "@/components/batches/BatchDetailDialog";
import { BatchFreezeButton } from "@/components/batches/BatchFreezeButton";
import { BatchInspectionDialog } from "@/components/batches/BatchInspectionDialog";
import { BatchLossHistoryDialog } from "@/components/batches/BatchLossHistoryDialog";
import { MoreHorizontal, FileText, ShieldAlert, ShieldCheck, ClipboardCheck, History } from "lucide-react";

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
      {/* 1. 主操作：电子码单详情 */}
      <BatchDetailDialog
        batch={batch}
        trigger={
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <FileText className="size-3.5 text-primary" />
            <span>电子码单</span>
          </Button>
        }
      />

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
        <DropdownMenuContent align="end" className="w-40">
          {/* 品控检测报告录入/修改 */}
          {(isQaOrAdmin || isWarehouseOrAdmin) && (
            <BatchInspectionDialog
              batch={batch}
              userId={userId}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <ClipboardCheck className="size-3.5 mr-2 text-emerald-600" />
                  <span>品控检测报告</span>
                </DropdownMenuItem>
              }
            />
          )}

          {/* 损耗履历 */}
          <BatchLossHistoryDialog
            batch={batch}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <History className="size-3.5 mr-2 text-primary" />
                <span>盘点损耗履历</span>
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
