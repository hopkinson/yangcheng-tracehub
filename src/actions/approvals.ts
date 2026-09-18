"use server";

import { prisma } from "@/lib/prisma";
import { Invariants } from "@/lib/invariants";
import { requireRole } from "@/lib/auth";
import { approvalRoles } from "@/config/approval";
import { getApprovalSetting } from "@/lib/approval-settings";
import { revalidatePath } from "next/cache";
import { releasePoolSpecLockIfEmpty } from "@/lib/holding-pool";

// 审批蟹扣领用
export async function approveTagClaimAction(data: {
  claimId: string;
  approved: boolean;
  comment?: string;
  approverId?: string;
}) {
  const approvalSetting = await getApprovalSetting();
  const operator = await requireRole(approvalRoles(approvalSetting.tagClaimRole));
  const approverId = operator.id;

  return await prisma.$transaction(async (tx) => {
    const claim = await tx.tagClaim.findUniqueOrThrow({
      where: { id: data.claimId },
      include: {
        farmer: {
          include: {
            tagClaims: { where: { status: "APPROVED" } },
          },
        },
      },
    });

    if (claim.status !== "PENDING") {
      throw new Error("该蟹扣申请已被处理，请勿重复审批");
    }

    if (data.approved) {
      const cumulativeBoundCount = claim.farmer.tagClaims.reduce((sum, c) => sum + c.boundCount, 0);

      const tagCheck = Invariants.checkTagClaim({
        farmerQuota: claim.farmer.quota,
        cumulativeBoundCount,
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
      revalidatePath("/farmers");
    } catch {}
    return updated;
  });
}

// 审批出库单 (强校验冷库规格库存与批次在池存活)
export async function approveOutboundOrderAction(data: {
  orderId: string;
  approved: boolean;
  comment?: string;
  rejectReason?: string;
  approverId?: string;
}) {
  const approvalSetting = await getApprovalSetting();
  const operator = await requireRole(approvalRoles(approvalSetting.outboundRole));
  const approverId = operator.id;

  return await prisma.$transaction(async (tx) => {
    const order = await tx.outboundOrder.findUniqueOrThrow({
      where: { id: data.orderId },
      include: {
        batch: { include: { pool: true } },
        lines: {
          include: {
            coldLog: {
              include: {
                sortTask: {
                  include: {
                    bundleBatch: { include: { sourceBatch: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (order.status !== "PENDING") {
      throw new Error("该出库单已被处理，请勿重复审批");
    }

    const orderIds = order.lines.map((l) => l.orderId).filter((id): id is string => Boolean(id));

    if (data.approved) {
      for (const line of order.lines) {
        if (!line.coldLogId || !line.coldLog?.sortTask?.bundleBatch?.sourceBatchId) {
          throw new Error(`出库审批拦截: 明细 ${line.orderNo} 缺少完整原料批次绑定，请重新生成出库单`);
        }
      }

      // 1. 再次校验冷库各规格实时可用库存 (防审批期间被其他单抢占)
      const specDemands = Object.values(
        order.lines.reduce((acc, l) => {
          const key = `${l.gender}_${l.weightTier}`;
          acc[key] = acc[key] || { gender: l.gender, weightTier: l.weightTier, count: 0 };
          acc[key].count += l.count;
          return acc;
        }, {} as Record<string, { gender: string; weightTier: string; count: number }>)
      );

      for (const { gender, weightTier, count } of specDemands) {
        const qualifiedAgg = await tx.sortTask.aggregate({
          where: { status: "COMPLETED", gender, weightTier },
          _sum: { qualifiedCount: true },
        });
        const totalQualified = qualifiedAgg._sum.qualifiedCount || 0;

        const otherOutboundAgg = await tx.outboundLine.aggregate({
          where: {
            gender,
            weightTier,
            outboundOrderId: { not: order.id },
            outboundOrder: { status: { not: "REJECTED" } },
          },
          _sum: { count: true },
        });
        const otherUsed = otherOutboundAgg._sum.count || 0;
        const availableStock = Math.max(0, totalQualified - otherUsed);

        if (availableStock < count) {
          const specLabel = `${gender === "MALE" ? "公蟹" : "母蟹"} ${weightTier}`;
          throw new Error(`冷库库存不足：${specLabel} 仅剩可用 ${availableStock} 只，本次需要 ${count} 只`);
        }
      }

      // 2. 校验单票数量一致性
      if (order.outboundCount !== order.channelOrderCount) {
        throw new Error(`出库审批拦截: 出库数量 (${order.outboundCount}) 与渠道订单数量 (${order.channelOrderCount}) 不一致`);
      }

      // 3. 校验与扣减批次（仅未关联保鲜库批次时校验并扣减原料暂养池；基于保鲜库批次出库时，实物早已捆扎出池并入冷库）
      if (order.batch && !order.coldLogId) {
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

        await releasePoolSpecLockIfEmpty(tx, order.batch.poolId);
      }

      // 3. 关联订单自动置为「已发货」
      if (orderIds.length > 0) {
        await tx.order.updateMany({
          where: { id: { in: orderIds } },
          data: { status: "SHIPPED" },
        });
      }
    } else {
      // 驳回逻辑：释放库存占用，回滚关联订单为待发货
      if (orderIds.length > 0) {
        await tx.order.updateMany({
          where: { id: { in: orderIds } },
          data: { status: "PENDING" },
        });
      }
    }

    const updated = await tx.outboundOrder.update({
      where: { id: order.id },
      data: {
        status: data.approved ? "APPROVED" : "REJECTED",
        rejectReason: data.approved ? null : (data.rejectReason || data.comment),
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
          reason: data.rejectReason || data.comment,
        }),
      },
    });

    try {
      revalidatePath("/approvals");
      revalidatePath("/outbound");
      revalidatePath("/orders");
      revalidatePath("/batches");
      revalidatePath("/pools");
    } catch {}
    return updated;
  });
}
