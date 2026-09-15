"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { updateApprovalSettingAction } from "@/actions/approval-settings";
import {
  APPROVAL_ROLES,
  APPROVAL_ROLE_LABELS,
  type ApprovalRole,
} from "@/config/approval";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ApprovalSettingsCard({
  setting,
}: {
  setting: { tagClaimRole: ApprovalRole; outboundRole: ApprovalRole };
}) {
  const [tagClaimRole, setTagClaimRole] = useState<ApprovalRole>(setting.tagClaimRole);
  const [outboundRole, setOutboundRole] = useState<ApprovalRole>(setting.outboundRole);
  const [savedSetting, setSavedSetting] = useState(setting);
  const [saving, setSaving] = useState(false);

  const changed =
    tagClaimRole !== savedSetting.tagClaimRole || outboundRole !== savedSetting.outboundRole;

  async function handleSave() {
    setSaving(true);
    try {
      await updateApprovalSettingAction({ tagClaimRole, outboundRole });
      setSavedSetting({ tagClaimRole, outboundRole });
      toast.success("审批角色配置已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "审批配置保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-primary" />
          审批配置
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          当前仅配置蟹扣领用与出库两个审批节点；超级管理员始终拥有兜底审批权限。
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">蟹扣领用审批</span>
          <Select value={tagClaimRole} onValueChange={(value) => setTagClaimRole(value as ApprovalRole)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPROVAL_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {APPROVAL_ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">出库审批</span>
          <Select value={outboundRole} onValueChange={(value) => setOutboundRole(value as ApprovalRole)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPROVAL_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {APPROVAL_ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} disabled={saving || !changed} className="sm:w-28">
          {saving ? "保存中..." : "保存配置"}
        </Button>
      </CardContent>
    </Card>
  );
}
