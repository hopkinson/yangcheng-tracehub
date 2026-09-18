import { prisma } from "@/lib/prisma";
import {
  DEFAULT_APPROVAL_SETTING,
  isApprovalRole,
  type ApprovalRole,
} from "@/config/approval";

export interface ApprovalSettingValue {
  tagClaimRole: ApprovalRole;
  outboundRole: ApprovalRole;
}

export async function getApprovalSetting(): Promise<ApprovalSettingValue> {
  // ponytail: 表由 prisma db push 按 schema 创建，不再运行期补建 —— 运行期 DDL 就是 schema 漂移的来源
  const rows = await prisma.$queryRaw<Array<{ tagClaimRole: string; outboundRole: string }>>`
    SELECT "tagClaimRole", "outboundRole"
    FROM "ApprovalSetting"
    WHERE "id" = 'default'
    LIMIT 1
  `;
  const setting = rows[0];

  return {
    tagClaimRole:
      setting && isApprovalRole(setting.tagClaimRole)
        ? setting.tagClaimRole
        : DEFAULT_APPROVAL_SETTING.tagClaimRole,
    outboundRole:
      setting && isApprovalRole(setting.outboundRole)
        ? setting.outboundRole
        : DEFAULT_APPROVAL_SETTING.outboundRole,
  };
}
