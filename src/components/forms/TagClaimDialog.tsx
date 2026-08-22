"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { requestTagClaimAction } from "@/actions/tags";
import { tagClaimFormSchema, type TagClaimFormValues } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { Plus, Tag } from "lucide-react";

export function TagClaimDialog({
  farmers,
  userId,
}: {
  farmers: Array<{
    id: string;
    name: string;
    code: string;
    quota: number;
    activeInPool: number;
    claimedSoFar: number;
  }>;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<TagClaimFormValues>({
    resolver: zodResolver(tagClaimFormSchema),
    defaultValues: {
      farmerId: farmers[0]?.id || "",
      claimCount: 500,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        farmerId: farmers[0]?.id || "",
        claimCount: 500,
      });
    }
  }, [open, farmers, form]);

  const selectedFarmerId = form.watch("farmerId");
  const currentFarmer = farmers.find((f) => f.id === selectedFarmerId);
  const remainingQuota = currentFarmer ? Math.max(0, currentFarmer.quota - currentFarmer.claimedSoFar) : 0;
  const maxClaimable = currentFarmer ? Math.min(currentFarmer.activeInPool, remainingQuota) : 0;

  async function onSubmit(data: TagClaimFormValues) {
    const count = Number(data.claimCount);
    if (count > maxClaimable) {
      form.setError("claimCount", {
        message: `超出最大可领扣余量: 当前上限为 ${maxClaimable} 只`,
      });
      return;
    }

    setLoading(true);
    try {
      await requestTagClaimAction({
        farmerId: data.farmerId,
        claimCount: count,
        applicantId: userId,
      });

      toast.success("蟹扣领用申请已提交，等待审批");
      setOpen(false);
      form.reset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "申请失败";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="size-4" data-icon="inline-start" />
          蟹扣领用申请
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Tag className="size-5 text-primary" />
            <DialogTitle>蟹扣领用申请 (按养殖户)</DialogTitle>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <FormField
              control={form.control}
              name="farmerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>选择来源养殖户</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择养殖户" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {farmers.map((f) => {
                        const rem = Math.max(0, f.quota - f.claimedSoFar);
                        const maxAvail = Math.min(f.activeInPool, rem);
                        return (
                          <SelectItem key={f.id} value={f.id}>
                            {f.code} - {f.name} (可领余量: {maxAvail} 只)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {currentFarmer && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs flex flex-col gap-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">年度签约额度:</span>
                  <span>{currentFarmer.quota.toLocaleString()} 只</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">该户名下在池存活合计:</span>
                  <span>{currentFarmer.activeInPool.toLocaleString()} 只</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">年度累计已核销蟹扣:</span>
                  <span>{currentFarmer.claimedSoFar.toLocaleString()} 只</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold text-emerald-600">
                  <span>当前最大可领扣余量:</span>
                  <span className="text-sm">{maxClaimable.toLocaleString()} 只</span>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="claimCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>本次领用数量 (只)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max={maxClaimable || undefined} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={loading || maxClaimable <= 0}>
                {loading ? "提交中..." : "提交领用申请"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
