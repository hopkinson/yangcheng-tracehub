"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toggleBatchFreezeAction } from "@/actions/batches";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck } from "lucide-react";

export function BatchFreezeButton({
  batchId,
  batchCode,
  isFrozen,
  userId,
  trigger,
}: {
  batchId: string;
  batchCode: string;
  isFrozen: boolean;
  userId: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("损耗超标 / 抽检待复核");

  async function handleConfirm() {
    const actionName = isFrozen ? "解冻" : "冻结";
    setLoading(true);
    try {
      await toggleBatchFreezeAction({
        batchId,
        freeze: !isFrozen,
        reason: !isFrozen ? reason : undefined,
        userId,
      });
      toast.success(`批次【${batchCode}】已${actionName}`);
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `${actionName}失败`;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            variant={isFrozen ? "default" : "outline"}
            size="sm"
            className={
              isFrozen
                ? "h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                : "h-7 text-xs gap-1 text-destructive hover:bg-destructive/10 border-destructive/30"
            }
            disabled={loading}
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
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {isFrozen ? (
                <ShieldCheck className="size-5 text-emerald-600" />
              ) : (
                <ShieldAlert className="size-5 text-destructive" />
              )}
              <DialogTitle>{isFrozen ? "确认解冻批次" : "冻结批次"}</DialogTitle>
            </div>
            <DialogDescription>
              目标批次：<span className="font-mono font-bold text-foreground">{batchCode}</span>
            </DialogDescription>
          </DialogHeader>

          {isFrozen ? (
            <div className="py-2 text-xs text-muted-foreground leading-relaxed">
              解冻后，该批次恢复正常状态，允许申请出库与蟹扣领用。
            </div>
          ) : (
            <div className="flex flex-col gap-3 py-2">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                冻结期间，该批次禁止申请出库与蟹扣领用。
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="freeze-reason" className="text-xs">
                  冻结原因 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="freeze-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="请输入冻结原因（如：损耗超标待查）"
                  className="text-xs h-9"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-row justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="button"
              variant={isFrozen ? "default" : "destructive"}
              size="sm"
              onClick={handleConfirm}
              disabled={loading || (!isFrozen && !reason.trim())}
            >
              {loading ? "处理中..." : isFrozen ? "确认解冻" : "确认冻结"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}

