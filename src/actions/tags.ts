"use server";

import { prisma } from "@/lib/prisma";
import { Invariants } from "@/lib/invariants";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getBeijingDateStr } from "@/lib/utils";

export async function requestTagClaimAction(data: {
  farmerId: string;
  claimCount: number;
  applicantId: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  return await prisma.$transaction(async (tx) => {
    const farmer = await tx.farmer.findUniqueOrThrow({
      where: { id: data.farmerId },
      include: {
        batches: { where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
        tagClaims: { where: { status: "APPROVED" } },
      },
    });

    const activeInPool = farmer.batches.reduce((sum, b) => sum + (b.inPoolCount - b.outPoolCount - b.lossCount), 0);
    const cumulativeClaimed = farmer.tagClaims.reduce((sum, c) => sum + c.boundCount, 0);

    const tagCheck = Invariants.checkTagClaim({
      farmerQuota: farmer.quota,
      cumulativeClaimed,
      activeInPoolCount: activeInPool,
      requestedCount: data.claimCount,
    });

    if (!tagCheck.valid) {
      throw new Error(tagCheck.reason);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 校验该养殖户是否存在历史未轧平的蟹扣（不得隔日留存）
    const unBalancedPrevious = await tx.tagClaim.findFirst({
      where: {
        farmerId: data.farmerId,
        status: "APPROVED",
        isBalanced: false,
        claimDate: { lt: today },
      },
    });
    if (unBalancedPrevious) {
      throw new Error("该养殖户存在前日未轧平的蟹扣记录，须先完成退废核销方可再次领用");
    }

    const prefix = `XK${getBeijingDateStr(today)}`;
    const count = await tx.tagClaim.count({ where: { code: { startsWith: prefix } } });
    const code = `${prefix}${String(count + 1).padStart(2, "0")}`;

    const claim = await tx.tagClaim.create({
      data: {
        code,
        claimDate: today,
        farmerId: data.farmerId,
        claimCount: data.claimCount,
        applicantId: data.applicantId,
        status: "PENDING",
      },
    });

    await tx.auditLog.create({
      data: {
        operatorId: data.applicantId,
        action: "TAG_CLAIM_REQUEST",
        entityType: "TAG_CLAIM",
        entityId: claim.id,
        details: JSON.stringify({ farmerCode: farmer.code, claimCount: data.claimCount }),
      },
    });

    try {
      revalidatePath("/tags");
      revalidatePath("/approvals");
    } catch {}
    return claim;
  });
}

export async function resubmitTagClaimAction(data: {
  claimId: string;
  claimCount: number;
  applicantId: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  return await prisma.$transaction(async (tx) => {
    const claim = await tx.tagClaim.findUniqueOrThrow({
      where: { id: data.claimId },
      include: {
        farmer: {
          include: {
            batches: { where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
            tagClaims: { where: { status: "APPROVED" } },
          },
        },
      },
    });

    const activeInPool = claim.farmer.batches.reduce((sum, b) => sum + (b.inPoolCount - b.outPoolCount - b.lossCount), 0);
    const cumulativeClaimed = claim.farmer.tagClaims.reduce((sum, c) => sum + c.boundCount, 0);

    const tagCheck = Invariants.checkTagClaim({
      farmerQuota: claim.farmer.quota,
      cumulativeClaimed,
      activeInPoolCount: activeInPool,
      requestedCount: data.claimCount,
    });

    if (!tagCheck.valid) {
      throw new Error(tagCheck.reason);
    }

    const updated = await tx.tagClaim.update({
      where: { id: data.claimId },
      data: {
        claimCount: data.claimCount,
        status: "PENDING",
        approvalComment: null,
      },
    });

    await tx.auditLog.create({
      data: {
        operatorId: data.applicantId,
        action: "RESUBMIT_TAG_CLAIM",
        entityType: "TAG_CLAIM",
        entityId: claim.id,
        details: JSON.stringify({ farmerCode: claim.farmer.code, claimCount: data.claimCount }),
      },
    });

    try {
      revalidatePath("/tags");
      revalidatePath("/approvals");
    } catch {}
    return updated;
  });
}

export async function settleDailyTagClaimAction(data: {
  tagClaimId: string;
  boundCount?: number;
  returnedCount: number;
  returnReason?: string;
  scrappedCount: number;
  scrapReason?: string;
  operatorId: string;
}) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  return await prisma.$transaction(async (tx) => {
    const claim = await tx.tagClaim.findUniqueOrThrow({
      where: { id: data.tagClaimId },
    });

    const boundCount = data.boundCount ?? claim.boundCount;

    const balanceCheck = Invariants.checkDailyBalance({
      claimedCount: claim.claimCount,
      boundCount,
      returnedCount: data.returnedCount,
      scrappedCount: data.scrappedCount,
    });

    if (!balanceCheck.isBalanced) {
      throw new Error(balanceCheck.reason);
    }

    const updatedClaim = await tx.tagClaim.update({
      where: { id: claim.id },
      data: {
        boundCount,
        returnedCount: data.returnedCount,
        returnReason: data.returnReason,
        scrappedCount: data.scrappedCount,
        scrapReason: data.scrapReason,
        isBalanced: true,
      },
    });

    await tx.auditLog.create({
      data: {
        operatorId: data.operatorId,
        action: "TAG_DAILY_SETTLEMENT",
        entityType: "TAG_CLAIM",
        entityId: claim.id,
        details: JSON.stringify({
          claimCount: claim.claimCount,
          boundCount: data.boundCount,
          returnedCount: data.returnedCount,
          scrappedCount: data.scrappedCount,
        }),
      },
    });

    try {
      revalidatePath("/tags");
      revalidatePath("/ledgers");
    } catch {}
    return updatedClaim;
  });
}

