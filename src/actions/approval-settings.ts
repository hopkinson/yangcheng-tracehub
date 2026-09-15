"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { isApprovalRole } from "@/config/approval";
import { getApprovalSetting } from "@/lib/approval-settings";

export async function updateApprovalSettingAction(data: {
  tagClaimRole: string;
  outboundRole: string;
}) {
  const operator = await requireRole(["ADMIN"]);

  if (!isApprovalRole(data.tagClaimRole) || !isApprovalRole(data.outboundRole)) {
    throw new Error("审批角色配置无效");
  }

  const previous = await getApprovalSetting();
  await prisma.$executeRaw`
    INSERT INTO "ApprovalSetting" ("id", "tagClaimRole", "outboundRole")
    VALUES ('default', ${data.tagClaimRole}, ${data.outboundRole})
    ON CONFLICT ("id") DO UPDATE SET
      "tagClaimRole" = excluded."tagClaimRole",
      "outboundRole" = excluded."outboundRole"
  `;
  const next = {
    tagClaimRole: data.tagClaimRole,
    outboundRole: data.outboundRole,
  };

  await prisma.auditLog.create({
    data: {
      operatorId: operator.id,
      action: "UPDATE_APPROVAL_SETTING",
      entityType: "APPROVAL_SETTING",
      entityId: "default",
      details: JSON.stringify({ previous, next }),
    },
  });

  revalidatePath("/");
  revalidatePath("/users");
  revalidatePath("/approvals");

  return next;
}
