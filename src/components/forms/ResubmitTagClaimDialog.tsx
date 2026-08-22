"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { resubmitTagClaimAction } from "@/actions/tags";
import { resubmitTagClaimFormSchema, type ResubmitTagClaimFormValues } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

export function ResubmitTagClaimDialog({
  claim,
  userId,
}: {
  claim: {
    id: string;
    claimCount: number;
    farmer: { name: string; code: string };
    approvalComment?: string | null;
  };
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<ResubmitTagClaimFormValues>({
    resolver: zodResolver(resubmitTagClaimFormSchema),
    defaultValues: {
      claimCount: claim.claimCount,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        claimCount: claim.claimCount,
      });
    }
  }, [open, claim.claimCount, form]);

  async function onSubmit(data: ResubmitTagClaimFormValues) {
    setLoading(true);
    try {
      await resubmitTagClaimAction({
        claimId: claim.id,
        claimCount: Number(data.claimCount),
        applicantId: userId,
      });
      toast.success("已重新提交领用申请，请等待品控审批！");
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "重新提交失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-primary">
          <RefreshCw className="size-3" />
          修改重提
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改并重新提交蟹扣申请</DialogTitle>
          <DialogDescription>
            来源养殖户：{claim.farmer.name} ({claim.farmer.code})
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            {claim.approvalComment && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                <span className="font-semibold">此前品控驳回原因：</span> {claim.approvalComment}
              </div>
            )}

            <FormField
              control={form.control}
              name="claimCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>修正领用数量 (只)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "提交中..." : "重新提报"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
