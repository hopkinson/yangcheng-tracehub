"use server";

import { prisma } from "@/lib/prisma";
import { Invariants } from "@/lib/invariants";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// 审批蟹扣领用
export async function approveTagClaimAction(data: {
  claimId: string;
  approved: boolean;
  comment?: string;
  approverId?: string;
}) {
  const operator = await requireRole(["QA_DIRECTOR", "ADMIN"]);
  const approverId = operator.id;

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

    if (claim.status !== "PENDING") {
      throw new Error("该蟹扣申请已被处理，请勿重复审批");
    }

    if (data.approved) {
      const activeInPool = claim.farmer.batches.reduce(
        (sum, b) => sum + (b.inPoolCount - b.outPoolCount - b.lossCount),
        0
      );
      const cumulativeClaimed = claim.farmer.tagClaims.reduce((sum, c) => sum + c.boundCount, 0);

      const tagCheck = Invariants.checkTagClaim({
        farmerQuota: claim.farmer.quota,
        cumulativeClaimed,
        activeInPoolCount: activeInPool,
        requestedCount: claim.claimCount,
      });

      if (!tagCheck.valid) {
        throw new Error(`审批拦截: ${tagCheck.reason}`);
      }
    }

    const updated = await tx.tagClaim.update({
      where: { id: claim.id },
      data: {
        status: data.approved ? "APPROVED" : "REJECTED",
        approverId,
        approvalComment: data.comment,
        approvedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        operatorId: approverId,
        action: data.approved ? "APPROVE_TAG_CLAIM" : "REJECT_TAG_CLAIM",
        entityType: "TAG_CLAIM",
        entityId: claim.id,
        details: JSON.stringify({ claimId: claim.id, approved: data.approved, comment: data.comment }),
      },
    });

    try {
      revalidatePath("/approvals");
      revalidatePath("/tags");
    } catch {}
    return updated;
  });
}

// 审批出库单 (强校验批次在池存活)
export async function approveOutboundOrderAction(data: {
  orderId: string;
  approved: boolean;
  comment?: string;
  rejectReason?: string;
  approverId?: string;
}) {
  const operator = await requireRole(["QA_DIRECTOR", "ADMIN"]);
  const approverId = operator.id;

  return await prisma.$transaction(async (tx) => {
    const order = await tx.outboundOrder.findUniqueOrThrow({
      where: { id: data.orderId },
      include: { batch: { include: { pool: true } } },
    });

    if (order.status !== "PENDING") {
      throw new Error("该出库单已被处理，请勿重复审批");
    }

    if (data.approved) {
      const bookInPool = order.batch.inPoolCount - order.batch.outPoolCount - order.batch.lossCount;
      const outboundCheck = Invariants.checkOutbound({
        bookInPool,
        outboundCount: order.outboundCount,
        channelOrderCount: order.channelOrderCount,
      });

      if (!outboundCheck.valid) {
        throw new Error(`出库审批拦截: ${outboundCheck.reason}`);
      }

      // 扣减批次库存
      const newOutPool = order.batch.outPoolCount + order.outboundCount;
      const remaining = order.batch.inPoolCount - newOutPool - order.batch.lossCount;
      const newBatchStatus = remaining === 0 ? "COMPLETED" : "PARTIALLY_OUTBOUND";

      await tx.batch.update({
        where: { id: order.batch.id },
        data: {
          outPoolCount: newOutPool,
          status: newBatchStatus,
        },
      });

      // 联动绑扣核销：自动归集扣减该养殖户当日已审批的蟹扣领用
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayClaims = await tx.tagClaim.findMany({
        where: {
          farmerId: order.batch.farmerId,
          status: "APPROVED",
        },
        orderBy: { claimDate: "asc" },
      });

      let remainingToBind = order.outboundCount;
      for (const claim of todayClaims) {
        if (remainingToBind <= 0) break;
        const availableInClaim = claim.claimCount - claim.boundCount - claim.returnedCount - claim.scrappedCount;
        if (availableInClaim > 0) {
          const delta = Math.min(remainingToBind, availableInClaim);
          const newBound = claim.boundCount + delta;
          const isBalanced = claim.claimCount === (newBound + claim.returnedCount + claim.scrappedCount);
          await tx.tagClaim.update({
            where: { id: claim.id },
            data: {
              boundCount: newBound,
              isBalanced,
            },
          });
          remainingToBind -= delta;
        }
      }

      // 检查池子是否全部清空，若清空则释放池子规格锁定
      const activeBatchesInPool = await tx.batch.findMany({
        where: {
          poolId: order.batch.poolId,
          status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] },
        },
      });

      const poolRemaining = activeBatchesInPool.reduce(
        (sum, b) => sum + (b.inPoolCount - b.outPoolCount - b.lossCount),
        0
      );

      if (poolRemaining === 0) {
        await tx.holdingPool.update({
          where: { id: order.batch.poolId },
          data: { currentGender: null, currentWeightTier: null },
        });
      }
    }

    const updated = await tx.outboundOrder.update({
      where: { id: order.id },
      data: {
        status: data.approved ? "APPROVED" : "REJECTED",
        rejectReason: data.approved ? null : data.rejectReason,
        approverId,
        approvalComment: data.comment,
        approvedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        operatorId: approverId,
        action: data.approved ? "APPROVE_OUTBOUND" : "REJECT_OUTBOUND",
        entityType: "OUTBOUND_ORDER",
        entityId: order.id,
        details: JSON.stringify({
          orderCode: order.code,
          approved: data.approved,
          outboundCount: order.outboundCount,
        }),
      },
    });

    try {
      revalidatePath("/approvals");
      revalidatePath("/outbound");
      revalidatePath("/batches");
      revalidatePath("/pools");
    } catch {}
    return updated;
  });
}
