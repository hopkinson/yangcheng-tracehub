"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { settleDailyTagClaimAction } from "@/actions/tags";
import { settleTagClaimFormSchema, type SettleTagClaimFormValues } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { Scale, CheckCircle2, AlertTriangle } from "lucide-react";

export function SettleTagClaimDialog({
  claim,
  userId,
}: {
  claim: {
    id: string;
    claimDate: Date | string;
    claimCount: number;
    boundCount: number;
    returnedCount: number;
    returnReason?: string | null;
    scrappedCount: number;
    scrapReason?: string | null;
    isBalanced: boolean;
    farmer: { name: string; code: string };
  };
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const remaining = Math.max(0, claim.claimCount - claim.boundCount);

  const form = useForm<SettleTagClaimFormValues>({
    resolver: zodResolver(settleTagClaimFormSchema),
    defaultValues: {
      returnedCount: claim.returnedCount || (claim.isBalanced ? 0 : remaining),
      returnReason: claim.returnReason || "",
      scrappedCount: claim.scrappedCount || 0,
      scrapReason: claim.scrapReason || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        returnedCount: claim.returnedCount || (claim.isBalanced ? 0 : remaining),
        returnReason: claim.returnReason || "",
        scrappedCount: claim.scrappedCount || 0,
        scrapReason: claim.scrapReason || "",
      });
    }
  }, [open, claim, remaining, form]);

  const returnedVal = Number(form.watch("returnedCount")) || 0;
  const scrappedVal = Number(form.watch("scrappedCount")) || 0;
  const totalAccounted = claim.boundCount + returnedVal + scrappedVal;
  const isBalanced = totalAccounted === claim.claimCount;
  const diff = claim.claimCount - totalAccounted;

  async function onSubmit(data: SettleTagClaimFormValues) {
    if (!isBalanced) {
      toast.error(`数量未轧平，领扣数 (${claim.claimCount}) 与已核销数 (${totalAccounted}) 差额 ${diff} 只`);
      return;
    }

    setLoading(true);
    try {
      await settleDailyTagClaimAction({
        tagClaimId: claim.id,
        boundCount: claim.boundCount,
        returnedCount: Number(data.returnedCount),
        returnReason: data.returnReason,
        scrappedCount: Number(data.scrappedCount),
        scrapReason: data.scrapReason,
        operatorId: userId,
      });

      toast.success("蟹扣日结核销登记成功，数量已轧平！");
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "核销登记失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={claim.isBalanced ? "ghost" : "outline"} size="sm" className="h-7 text-xs gap-1">
          <Scale className="size-3" />
          {claim.isBalanced ? "查看核销" : "登记退废"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>蟹扣退回与作废登记 (日结核销)</DialogTitle>
          <DialogDescription>
            养殖户：{claim.farmer.name} ({claim.farmer.code})
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-3 text-xs flex flex-col gap-1.5 font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">申请领扣总数:</span>
            <span className="font-bold">{claim.claimCount} 只</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">出库已绑扣数:</span>
            <span>{claim.boundCount} 只</span>
          </div>
          <div className="flex justify-between border-t pt-1">
            <span className="text-muted-foreground">当前核销合计:</span>
            <span className="font-semibold">
              {totalAccounted} / {claim.claimCount} 只
            </span>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            {isBalanced ? (
              <span className="inline-flex items-center text-emerald-600 font-sans font-medium text-xs">
                <CheckCircle2 className="size-3.5 mr-1" />
                数量已完全轧平 (领扣 {claim.claimCount} = 绑扣 {claim.boundCount} + 退回 {returnedVal} + 作废 {scrappedVal})
              </span>
            ) : (
              <span className="inline-flex items-center text-amber-600 font-sans font-medium text-xs">
                <AlertTriangle className="size-3.5 mr-1" />
                尚有差额 {Math.abs(diff)} 只 ({diff > 0 ? `缺 ${diff} 只` : `多 ${Math.abs(diff)} 只`})
              </span>
            )}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="returnedCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>当日退回数量 (只)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="returnReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>退回原因</FormLabel>
                    <FormControl>
                      <Input placeholder="如：未用完退回库房" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="scrappedCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>当日作废数量 (只)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="scrapReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>作废原因</FormLabel>
                    <FormControl>
                      <Input placeholder="如：扣带损坏作废" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" size="sm" disabled={loading || !isBalanced}>
                {loading ? "提交中..." : "保存核销结果"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
