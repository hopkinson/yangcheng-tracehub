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

// 审批出库单 (强校验冷库规格库存与批次在池存活)
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
      include: {
        batch: { include: { pool: true } },
        lines: true,
      },
    });

    if (order.status !== "PENDING") {
      throw new Error("该出库单已被处理，请勿重复审批");
    }

    const orderIds = order.lines.map((l) => l.orderId).filter((id): id is string => Boolean(id));

    if (data.approved) {
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

        // 检查池子是否全部清空，若清空则释放规格锁定
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

      // 联动绑扣核销：按出库明细穿透养殖户与蟹扣批次，自动归集核销已审批蟹扣
      // 1. 读取可能随出库申请留痕的 specBatchMap（用于精准定位规格与冷库批次）
      let specBatchMap: Record<string, string> = {};
      try {
        const audit = await tx.auditLog.findFirst({
          where: { entityId: order.id, action: { in: ["STORE_OUTBOUND_REQUEST", "CARD_OUTBOUND_REQUEST"] } },
          orderBy: { createdAt: "desc" },
        });
        specBatchMap = JSON.parse(audit?.details || "{}").specBatchMap || {};
      } catch {}

      // 2. 统计各养殖户在本次出库中的只数及优先核销的蟹扣批次
      interface FarmerDeduction {
        farmerId: string;
        count: number;
        preferredClaimIds: Set<string>;
      }
      const deductionsByFarmer = new Map<string, FarmerDeduction>();
      const specCache = new Map<string, { farmerId: string; tagClaimId?: string }>();

      if (order.lines && order.lines.length > 0) {
        for (const line of order.lines) {
          const normTier = Invariants.normalizeWeightTier(line.weightTier);
          const specKey = `${line.gender}_${normTier}`;

          let info = specCache.get(specKey);
          if (!info) {
            const coldLogId = specBatchMap[specKey] || (order.lines.length === 1 ? order.coldLogId : null);
            if (coldLogId) {
              const coldLog = await tx.coldLog.findUnique({ where: { id: coldLogId } });
              if (coldLog?.refId) {
                const task = await tx.sortTask.findFirst({
                  where: { OR: [{ code: coldLog.refId }, { id: coldLog.refId }] },
                  include: { bundleBatch: { include: { tagClaim: true } } },
                });
                const bundle = task?.bundleBatch || await tx.bundleBatch.findFirst({
                  where: { OR: [{ code: coldLog.refId }, { id: coldLog.refId }] },
                  include: { tagClaim: true },
                });
                if (bundle?.tagClaim) {
                  info = { farmerId: bundle.tagClaim.farmerId, tagClaimId: bundle.tagClaim.id };
                }
              }
            }

            if (!info) {
              const task = await tx.sortTask.findFirst({
                where: { status: "COMPLETED", gender: line.gender, weightTier: { in: [line.weightTier, normTier] } },
                orderBy: { doneAt: "desc" },
                include: { bundleBatch: { include: { tagClaim: true } } },
              });
              if (task?.bundleBatch?.tagClaim) {
                info = { farmerId: task.bundleBatch.tagClaim.farmerId, tagClaimId: task.bundleBatch.tagClaim.id };
              }
            }

            if (!info) {
              const item = await tx.batchItem.findFirst({
                where: { gender: line.gender, weightTier: { in: [line.weightTier, normTier] } },
                orderBy: { createdAt: "desc" },
                include: { batch: true },
              });
              if (item?.batch?.farmerId) info = { farmerId: item.batch.farmerId };
            }

            if (!info && order.batch?.farmerId) {
              info = { farmerId: order.batch.farmerId };
            }

            if (info) specCache.set(specKey, info);
          }

          if (info) {
            const d = deductionsByFarmer.get(info.farmerId) || { farmerId: info.farmerId, count: 0, preferredClaimIds: new Set<string>() };
            d.count += line.count;
            if (info.tagClaimId) d.preferredClaimIds.add(info.tagClaimId);
            deductionsByFarmer.set(info.farmerId, d);
          }
        }
      }

      // 若无明细行（单票旧模式），兜底使用主批次养殖户
      if (deductionsByFarmer.size === 0 && order.batch?.farmerId) {
        deductionsByFarmer.set(order.batch.farmerId, {
          farmerId: order.batch.farmerId,
          count: order.outboundCount,
          preferredClaimIds: new Set<string>(),
        });
      }

      // 3. 对每个养殖户执行蟹扣扣减轧平
      for (const { farmerId, count: farmerCount, preferredClaimIds } of deductionsByFarmer.values()) {
        const claims = await tx.tagClaim.findMany({
          where: {
            farmerId,
            status: "APPROVED",
          },
          orderBy: { claimDate: "asc" },
        });

        // 优先核销实际捆扎时选中的蟹扣批次
        const sortedClaims = claims.sort((a, b) => +preferredClaimIds.has(b.id) - +preferredClaimIds.has(a.id));

        let remaining = farmerCount;
        for (const claim of sortedClaims) {
          if (remaining <= 0) break;
          const availableInClaim = claim.claimCount - claim.boundCount - claim.returnedCount - claim.scrappedCount;
          if (availableInClaim > 0) {
            const delta = Math.min(remaining, availableInClaim);
            const newBound = claim.boundCount + delta;
            const isBalanced = claim.claimCount === (newBound + claim.returnedCount + claim.scrappedCount);
            await tx.tagClaim.update({
              where: { id: claim.id },
              data: {
                boundCount: newBound,
                isBalanced,
              },
            });
            remaining -= delta;
          }
        }
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
