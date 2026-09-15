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

async function createApprovalSettingTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ApprovalSetting" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
      "tagClaimRole" TEXT NOT NULL DEFAULT 'FARMER_ADMIN',
      "outboundRole" TEXT NOT NULL DEFAULT 'QA_DIRECTOR'
    )
  `);
}

export async function getApprovalSetting(): Promise<ApprovalSettingValue> {
  let rows: Array<{ tagClaimRole: string; outboundRole: string }>;
  try {
    rows = await prisma.$queryRaw`
      SELECT "tagClaimRole", "outboundRole"
      FROM "ApprovalSetting"
      WHERE "id" = 'default'
      LIMIT 1
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("no such table") || !message.includes("ApprovalSetting")) throw error;
    await createApprovalSettingTable();
    rows = [];
  }
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
