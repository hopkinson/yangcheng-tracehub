"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { Invariants } from "@/lib/invariants";
import { requireRole } from "@/lib/auth";
import { releasePoolSpecLockIfEmpty } from "@/lib/holding-pool";

import { getBeijingDateStr } from "@/lib/utils";

function revalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {}
}

// ============================================================================
// 1. 订单管理 Server Actions
// ============================================================================

import type { RawImportOrder } from "@/lib/invariants";

export async function importOrdersAction(rawOrders: RawImportOrder[]) {
  try {
    await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);

    if (!rawOrders || rawOrders.length === 0) {
      return { success: false, message: "导入订单列表不能为空" };
    }
    if (rawOrders.length > 5000) {
      return { success: false, message: "单次最多导入 5000 条发货需求" };
    }

    const dateStr = getBeijingDateStr();
    const importId = `IM${dateStr}${Math.floor(10 + Math.random() * 90)}`;

    const lastOrder = await prisma.order.findFirst({
      where: { code: { startsWith: `SO${dateStr}` } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    let idx = (Number(lastOrder?.code.slice(10)) || 0) + 1;

    const allStores = await prisma.store.findMany({
      select: { id: true, code: true, name: true },
    });
    const storeMap = new Map<string, { id: string; name: string }>();
    for (const s of allStores) {
      storeMap.set(s.code.toLowerCase(), s);
      storeMap.set(s.code.toLowerCase().replace(/^st-/, ""), s);
      storeMap.set(s.name, s);
    }

    const ordersToCreate: any[] = [];
    const incomingKeys = new Set<string>();

    for (const raw of rawOrders) {
      const orderNo = typeof raw.orderNo === "string" ? raw.orderNo.trim() : "";
      const count = Number(raw.count);
      const deliveryDate = Invariants.parseImportDate(raw.deliveryDate);
      const gender = raw.gender === "母" || raw.gender === "FEMALE" ? "FEMALE" : raw.gender === "公" || raw.gender === "MALE" ? "MALE" : null;
      const weightTier = typeof raw.weightTier === "string" && /\d/.test(raw.weightTier)
        ? Invariants.normalizeWeightTier(raw.weightTier)
        : null;

      if (!orderNo) throw new Error("订单号不能为空");
      if (raw.type !== "STORE_ORDER" && raw.type !== "CRAB_CARD") throw new Error(`订单 ${orderNo} 类型无效`);
      if (!gender || !weightTier) throw new Error(`订单 ${orderNo} 规格无效`);
      if (!Number.isInteger(count) || count <= 0) throw new Error(`订单 ${orderNo} 只数必须是正整数`);
      if (!deliveryDate) throw new Error(`订单 ${orderNo} 发货日期无效`);

      const tag = raw.type !== "CRAB_CARD" ? raw.orderNo.match(/SO\d{8}-([A-Za-z0-9_-]+)-/)?.[1]?.toLowerCase() : null;
      const storeCode = raw.storeCode?.trim().toLowerCase();
      const matchedStore =
        (storeCode ? storeMap.get(storeCode) : undefined) ||
        (tag ? storeMap.get(tag) : undefined) ||
        (raw.storeName ? storeMap.get(raw.storeName.trim()) : undefined);

      if (raw.type === "STORE_ORDER" && !matchedStore) {
        throw new Error(`订单 ${orderNo} 的门店“${raw.storeName || raw.storeCode || "未填写"}”未在门店主档中登记`);
      }

      const key = [raw.type, matchedStore?.id || "", orderNo, gender, weightTier, deliveryDate].join("|");
      if (incomingKeys.has(key)) throw new Error(`订单 ${orderNo} 存在重复规格 ${weightTier}`);
      incomingKeys.add(key);

      ordersToCreate.push({
        importId,
        code: `SO${dateStr}${String(idx++).padStart(3, "0")}`,
        orderNo,
        type: raw.type,
        storeId: matchedStore?.id || null,
        storeName: matchedStore?.name || raw.storeName || "蟹卡提货 (顺丰速运直发)",
        specModel: raw.specModel || null,
        deliveryDate: Invariants.normalizeDate(deliveryDate),
        gender,
        weightTier,
        count,
        status: "PENDING" as const,
      });
    }

    const existingOrders = await prisma.order.findMany({
      where: { orderNo: { in: [...new Set(ordersToCreate.map((order) => order.orderNo))] } },
      select: { type: true, storeId: true, orderNo: true, gender: true, weightTier: true, deliveryDate: true },
    });
    for (const order of existingOrders) {
      const key = [order.type, order.storeId || "", order.orderNo, order.gender, Invariants.normalizeWeightTier(order.weightTier), order.deliveryDate.toISOString().slice(0, 10)].join("|");
      if (incomingKeys.has(key)) throw new Error(`订单 ${order.orderNo} 已导入，请勿重复上传`);
    }

    await prisma.order.createMany({
      data: ordersToCreate,
    });

    revalidate("/orders");
    revalidate("/");
    return {
      success: true,
      importId,
      createdCount: ordersToCreate.length,
      message: `成功导入 ${ordersToCreate.length} 条发货需求（批次号：${importId}）`,
    };
  } catch (error: any) {
    console.error("importOrdersAction error:", error);
    return { success: false, message: error.message || "导入订单失败" };
  }
}

export async function deleteOrderBatchAction(importId: string, orderNo?: string) {
  try {
    const whereClause: any = { importId, status: "PENDING" };
    if (orderNo) {
      whereClause.orderNo = orderNo;
    }

    // 检查是否有已发货订单
    const shippedCount = await prisma.order.count({
      where: { importId, status: "SHIPPED", ...(orderNo ? { orderNo } : {}) },
    });

    if (shippedCount > 0) {
      return { success: false, message: "该批次包含已发货订单，不可整单删除" };
    }

    const res = await prisma.order.deleteMany({
      where: whereClause,
    });

    try {
      revalidate("/orders");
      revalidate("/");
    } catch {}
    return { success: true, message: `已成功删除 ${res.count} 条待发货订单记录` };
  } catch (error: any) {
    console.error("deleteOrderBatchAction error:", error);
    return { success: false, message: error.message || "删除订单失败" };
  }
}

export async function batchDeleteOrdersAction(orderIds: string[]) {
  try {
    if (!orderIds?.length) {
      return { success: false, message: "请勾选要删除的待发货订单" };
    }

    // 严密守恒：仅允许删除处于 PENDING 状态的待发货记录，杜绝破坏已发货出库台账
    const res = await prisma.order.deleteMany({
      where: {
        id: { in: orderIds },
        status: "PENDING",
      },
    });

    try {
      revalidate("/orders");
      revalidate("/");
    } catch {}
    return { success: true, message: `已成功删除 ${res.count} 条待发货订单记录` };
  } catch (error: any) {
    console.error("batchDeleteOrdersAction error:", error);
    return { success: false, message: error.message || "批量删除订单失败" };
  }
}

// ============================================================================
// 2. 捆扎管理 Server Actions
// ============================================================================

export async function createBundleBatchAction(data: {
  batchId?: string;
  groupId: string;
  tagClaimId: string;
  ropeBatch: string;
  lines: Array<{ poolId: string; gender: string; weightTier: string; count: number }>;
}) {
  try {
    const sourceBatchId = data.batchId?.trim();
    if (!sourceBatchId || !data.groupId || !data.tagClaimId || !data.ropeBatch.trim()) {
      return { success: false, message: "原料批次、捆扎班组、蟹扣批次与蟹绳批次均为必填项" };
    }
    if (!data.lines || data.lines.length === 0 || data.lines.some((l) => !Number.isInteger(l.count) || l.count <= 0)) {
      return { success: false, message: "必须至少选择一个有效来源池并输入正确只数" };
    }

    const liveCountOf = (batch: any) => {
      const list = batch.items?.length ? batch.items : [batch];
      return list.reduce(
        (sum: number, item: any) => sum + Math.max(0, item.inPoolCount - item.outPoolCount - item.lossCount),
        0
      );
    };

    const sourceBatch = await prisma.batch.findUnique({
      where: { id: sourceBatchId },
      include: { farmer: true, items: true },
    });
    if (!sourceBatch || !["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"].includes(sourceBatch.status) || liveCountOf(sourceBatch) <= 0) {
      return { success: false, message: "所选原料批次已无可捆扎库存，请刷新后重试" };
    }

    const pendingBatches = await prisma.batch.findMany({
      where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } },
      include: { items: true },
      orderBy: [{ inPoolTime: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    const oldestBatch = pendingBatches.find((batch) => liveCountOf(batch) > 0);
    if (oldestBatch && oldestBatch.id !== sourceBatch.id) {
      return {
        success: false,
        message: `请先处理更早入池的原料批次 ${oldestBatch.code}，当前批次 ${sourceBatch.code} 暂不可捆扎`,
      };
    }

    // 校验蟹扣是否为 APPROVED 状态及可用余量，并确保与原料批次同一养殖户。
    const tagClaim = await prisma.tagClaim.findUnique({
      where: { id: data.tagClaimId },
      include: {
        farmer: true,
        bundleBatches: { include: { lines: true } },
      },
    });
    if (!tagClaim || tagClaim.status !== "APPROVED") {
      return { success: false, message: "所选蟹扣批次未通过审核，禁止用于捆扎" };
    }
    if (tagClaim.farmerId !== sourceBatch.farmerId) {
      return { success: false, message: "蟹扣批次与所选原料批次不属于同一养殖户，禁止混扣" };
    }

    const totalCrabs = data.lines.reduce((acc, l) => acc + l.count, 0);
    const alreadyUsed = tagClaim.bundleBatches.flatMap((b) => b.lines).reduce((sum, l) => sum + l.count, 0);
    const availableTags = Math.max(
      0,
      tagClaim.claimCount -
        Math.max(alreadyUsed, tagClaim.boundCount || 0) -
        (tagClaim.returnedCount || 0) -
        (tagClaim.scrappedCount || 0)
    );

    if (totalCrabs > availableTags) {
      return {
        success: false,
        message: `本次捆扎只数 (${totalCrabs} 只) 超出所选蟹扣批次可用余量 (${availableTags} 只，总额 ${tagClaim.claimCount} 只)`,
      };
    }

    const poolIds = Array.from(new Set(data.lines.map((l) => l.poolId)));
    if (poolIds.length !== data.lines.length) {
      return { success: false, message: "同一暂养池不能重复提交，请合并出池数量" };
    }
    const pools = await prisma.holdingPool.findMany({ where: { id: { in: poolIds } } });
    const sourceEntries: any[] = sourceBatch.items.length > 0
      ? sourceBatch.items
      : [{
          id: null,
          poolId: sourceBatch.poolId,
          gender: sourceBatch.gender,
          weightTier: sourceBatch.weightTier,
          inPoolCount: sourceBatch.inPoolCount,
          outPoolCount: sourceBatch.outPoolCount,
          lossCount: sourceBatch.lossCount,
        }];

    for (const line of data.lines) {
      const pool = pools.find((item) => item.id === line.poolId);
      if (!pool) return { success: false, message: `暂养池 ${line.poolId} 不存在` };
      if (pool.status !== "ACTIVE") {
        return { success: false, message: `暂养池 ${pool.name || pool.code} 当前不可用，禁止出池捆扎` };
      }
      const sourceEntry = sourceEntries.find(
        (item) =>
          item.poolId === line.poolId &&
          item.gender === line.gender &&
          Invariants.normalizeWeightTier(item.weightTier) === Invariants.normalizeWeightTier(line.weightTier)
      );
      if (!sourceEntry) {
        return { success: false, message: `暂养池 ${pool.name || pool.code} 不属于原料批次 ${sourceBatch.code}，禁止跨批次出池` };
      }
      const available = Math.max(0, sourceEntry.inPoolCount - sourceEntry.outPoolCount - sourceEntry.lossCount);
      if (line.count > available) {
        return {
          success: false,
          message: `原料批次 ${sourceBatch.code} 在 ${pool.name || pool.code} 仅剩 ${available} 只可出池，本次申请 ${line.count} 只`,
        };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 事务内再次确认 FIFO 与库存，避免页面打开后批次状态已变化。
      const currentPending = await tx.batch.findMany({
        where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } },
        include: { items: true },
        orderBy: [{ inPoolTime: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      });
      const currentSource = currentPending.find((batch) => liveCountOf(batch) > 0);
      if (!currentSource || currentSource.id !== sourceBatchId) {
        throw new Error(currentSource
          ? `原料批次顺序已变化，请先处理 ${currentSource.code}`
          : "所选原料批次已无可捆扎库存");
      }

      const currentEntries: any[] = currentSource.items.length > 0
        ? currentSource.items
        : [{
            id: null,
            poolId: currentSource.poolId,
            gender: currentSource.gender,
            weightTier: currentSource.weightTier,
            inPoolCount: currentSource.inPoolCount,
            outPoolCount: currentSource.outPoolCount,
            lossCount: currentSource.lossCount,
          }];

      // 防止绕过页面直接提交：捆扎明细必须属于当前 FIFO 原料批次。
      for (const line of data.lines) {
        const entry = currentEntries.find(
          (item) =>
            item.poolId === line.poolId &&
            item.gender === line.gender &&
            Invariants.normalizeWeightTier(item.weightTier) === Invariants.normalizeWeightTier(line.weightTier)
        );
        if (!entry) {
          throw new Error(`捆扎明细不属于当前原料批次 ${currentSource.code}，请重新选择批次`);
        }
        const available = Math.max(0, entry.inPoolCount - entry.outPoolCount - entry.lossCount);
        if (line.count > available) {
          throw new Error(`原料批次 ${currentSource.code} 的暂养库存已变化，请刷新后重试`);
        }
      }

      const coreCode = sourceBatch.code.replace(/^(YL|PC)-?/, "").replace(/-/g, "");
      const baseCode = `KZD${coreCode}`;
      const existingBundles = await tx.bundleBatch.findMany({
        where: { sourceBatchId },
        select: { id: true, code: true },
        orderBy: { createdAt: "asc" },
      });

      if (existingBundles.length > 0) {
        const unsuffixed = existingBundles.find((item) => item.code === baseCode);
        const hasFirstSuffix = existingBundles.some((item) => item.code === `${baseCode}-1`);
        if (unsuffixed && !hasFirstSuffix) {
          await tx.bundleBatch.update({ where: { id: unsuffixed.id }, data: { code: `${baseCode}-1` } });
        }
      }

      const maxSuffix = existingBundles.reduce((max, item) => {
        if (item.code === baseCode) return Math.max(max, 1);
        if (!item.code.startsWith(`${baseCode}-`)) return max;
        const suffix = Number(item.code.slice(baseCode.length + 1));
        return Number.isInteger(suffix) ? Math.max(max, suffix) : max;
      }, 0);
      const code = existingBundles.length === 0 ? baseCode : `${baseCode}-${Math.max(2, maxSuffix + 1)}`;

      const bundleBatch = await tx.bundleBatch.create({
        data: {
          code,
          sourceBatchId,
          groupId: data.groupId,
          tagClaimId: data.tagClaimId,
          ropeBatch: data.ropeBatch.trim(),
          inputCount: totalCrabs,
          status: "BUNDLING",
          lines: {
            create: data.lines.map((line) => ({
              poolId: line.poolId,
              gender: line.gender,
              weightTier: Invariants.normalizeWeightTier(line.weightTier),
              count: line.count,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.bundleGroup.update({
        where: { id: data.groupId },
        data: { status: "BUNDLING" },
      });

      for (const line of data.lines) {
        if (currentSource.items.length > 0) {
          const entry = currentEntries.find(
            (item) =>
              item.poolId === line.poolId &&
              item.gender === line.gender &&
              Invariants.normalizeWeightTier(item.weightTier) === Invariants.normalizeWeightTier(line.weightTier)
          );
          await tx.batchItem.update({
            where: { id: entry.id },
            data: { outPoolCount: { increment: line.count } },
          });
        }
      }

      const newOutPoolCount = currentSource.outPoolCount + totalCrabs;
      const remaining = currentSource.inPoolCount - newOutPoolCount - currentSource.lossCount;
      await tx.batch.update({
        where: { id: currentSource.id },
        data: {
          outPoolCount: newOutPoolCount,
          status: remaining <= 0 ? "COMPLETED" : "PARTIALLY_OUTBOUND",
        },
      });

      for (const poolId of poolIds) {
        await releasePoolSpecLockIfEmpty(tx, poolId);
      }

      return { code, id: bundleBatch.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidate("/bundling");
    revalidate("/pools");
    revalidate("/batches");
    revalidate("/");
    return { success: true, code: result.code, message: `捆扎批次 ${result.code} 创建成功，进入【捆扎中】状态` };
  } catch (error: any) {
    console.error("createBundleBatchAction error:", error);
    return { success: false, message: error.message || "创建捆扎批次失败" };
  }
}

export async function completeBundleBatchAction(
  bundleId: string,
  lineResults: Array<{ lineId: string; qualifiedCount: number }>,
  lossReason?: string
) {
  try {
    const batch = await prisma.bundleBatch.findUnique({
      where: { id: bundleId },
      include: { lines: true },
    });
    if (!batch) return { success: false, message: "未找到指定的捆扎批次" };

    const totalInput = batch.lines.reduce((acc, l) => acc + l.count, 0);
    const totalQualified = lineResults.reduce((acc, l) => acc + l.qualifiedCount, 0);

    for (const res of lineResults) {
      const line = batch.lines.find((l) => l.id === res.lineId);
      if (!line) continue;
      if (res.qualifiedCount < 0 || res.qualifiedCount > line.count) {
        return { success: false, message: "合格只数必须在 0 到投入数量之间" };
      }
    }

    const lossRes = Invariants.calculateBundleLoss({
      inputCount: totalInput,
      qualifiedCount: totalQualified,
    });
    if (!lossRes.valid) {
      return { success: false, message: lossRes.reason };
    }

    if (lossRes.isException && !lossReason?.trim()) {
      return { success: false, message: "损耗率超过 5% 警戒阈值，必须填写损耗原因说明" };
    }

    await prisma.$transaction(async (tx) => {
      for (const res of lineResults) {
        const line = batch.lines.find((l) => l.id === res.lineId);
        if (line) {
          await tx.bundleLine.update({
            where: { id: line.id },
            data: {
              qualifiedCount: res.qualifiedCount,
              lossCount: line.count - res.qualifiedCount,
            },
          });
        }
      }

      await tx.bundleBatch.update({
        where: { id: bundleId },
        data: {
          inputCount: totalInput,
          qualifiedCount: totalQualified,
          lossCount: lossRes.lossCount,
          lossRate: lossRes.lossRate,
          lossReason: lossReason?.trim() || null,
          status: "COMPLETED",
          doneAt: new Date(),
        },
      });

      // 捆扎组置为 COMPLETED
      await tx.bundleGroup.update({
        where: { id: batch.groupId },
        data: { status: "COMPLETED" },
      });

      // 同步绑扣与损耗至蟹扣台账并自动轧平
      if (batch.tagClaimId) {
        const claim = await tx.tagClaim.findUnique({ where: { id: batch.tagClaimId } });
        if (claim) {
          const newBound = claim.boundCount + totalQualified;
          const newScrapped = claim.scrappedCount + lossRes.lossCount;
          const isBalanced = claim.claimCount === (newBound + claim.returnedCount + newScrapped);
          await tx.tagClaim.update({
            where: { id: claim.id },
            data: {
              boundCount: newBound,
              scrappedCount: newScrapped,
              scrapReason: claim.scrapReason || (lossRes.lossCount > 0 ? "捆扎损耗" : null),
              isBalanced,
            },
          });
        }
      }
    });

    revalidate("/bundling");
    revalidate("/sorting");
    revalidate("/tags");
    revalidate("/");
    return {
      success: true,
      message: `捆扎批次 ${batch.code} 已完成！合格 ${totalQualified} 只，损耗 ${lossRes.lossCount} 只（${lossRes.lossRate}%）`,
    };
  } catch (error: any) {
    console.error("completeBundleBatchAction error:", error);
    return { success: false, message: error.message || "确认完成捆扎失败" };
  }
}

export async function createBundleGroupAction(name: string) {
  try {
    const count = await prisma.bundleGroup.count();
    const code = `P${count + 1}`;
    await prisma.bundleGroup.create({
      data: { code, name: name.trim() || `捆扎${count + 1}组` },
    });
    revalidate("/bundling");
    return { success: true, message: `捆扎班组 ${name} (${code}) 创建成功` };
  } catch (error: any) {
    return { success: false, message: error.message || "创建班组失败" };
  }
}

export async function deleteBundleGroupAction(groupId: string) {
  try {
    const batchCount = await prisma.bundleBatch.count({ where: { groupId } });
    if (batchCount > 0) {
      return { success: false, message: "该班组名下存在历史捆扎批次，禁止删除" };
    }
    await prisma.bundleGroup.delete({ where: { id: groupId } });
    revalidate("/bundling");
    return { success: true, message: "捆扎班组已删除" };
  } catch (error: any) {
    return { success: false, message: error.message || "删除班组失败" };
  }
}

export async function deleteBundleBatchAction(bundleId: string) {
  try {
    const batch = await prisma.bundleBatch.findUnique({
      where: { id: bundleId },
      include: { lines: true, sortTasks: true },
    });
    if (!batch) return { success: false, message: "未找到指定的捆扎批次" };
    if (batch.sortTasks.length > 0) {
      return { success: false, message: "该批次已生成下游分拣任务，禁止撤销作废" };
    }

    await prisma.$transaction(async (tx) => {
      if (batch.sourceBatchId) {
        const sourceBatch = await tx.batch.findUnique({
          where: { id: batch.sourceBatchId },
          include: { items: true },
        });
        if (!sourceBatch) throw new Error("原料批次不存在，无法安全还原暂养库存");

        let restoredTotal = 0;
        for (const line of batch.lines) {
          if (sourceBatch.items.length > 0) {
            const item = sourceBatch.items.find(
              (entry) =>
                entry.poolId === line.poolId &&
                entry.gender === line.gender &&
                Invariants.normalizeWeightTier(entry.weightTier) === Invariants.normalizeWeightTier(line.weightTier)
            );
            if (!item || item.outPoolCount < line.count) {
              throw new Error(`原料批次 ${sourceBatch.code} 的出池记录不足，已停止撤销以避免还错批次`);
            }
            await tx.batchItem.update({
              where: { id: item.id },
              data: { outPoolCount: { decrement: line.count } },
            });
          } else if (sourceBatch.poolId !== line.poolId || sourceBatch.outPoolCount < line.count) {
            throw new Error(`原料批次 ${sourceBatch.code} 的出池记录不足，已停止撤销以避免还错批次`);
          }

          restoredTotal += line.count;
          await tx.holdingPool.update({
            where: { id: line.poolId },
            data: {
              currentGender: line.gender,
              currentWeightTier: Invariants.normalizeWeightTier(line.weightTier),
            },
          });
        }

        const newOutPoolCount = sourceBatch.outPoolCount - restoredTotal;
        await tx.batch.update({
          where: { id: sourceBatch.id },
          data: {
            outPoolCount: newOutPoolCount,
            status: newOutPoolCount <= 0 ? "TEMPORARY_HOLDING" : "PARTIALLY_OUTBOUND",
          },
        });
      } else {
        // 兼容历史捆扎批次：旧数据没有原料批次关联，只能按池与规格逆向还库。
        for (const line of batch.lines) {
          let remaining = line.count;
          const items = await tx.batchItem.findMany({
            where: { poolId: line.poolId, gender: line.gender, weightTier: line.weightTier, outPoolCount: { gt: 0 } },
            orderBy: { createdAt: "desc" },
          });

          for (const item of items) {
            if (remaining <= 0) break;
            const restore = Math.min(remaining, item.outPoolCount);
            remaining -= restore;
            await tx.batchItem.update({ where: { id: item.id }, data: { outPoolCount: { decrement: restore } } });
            await tx.batch.update({
              where: { id: item.batchId },
              data: { outPoolCount: { decrement: restore }, status: "PARTIALLY_OUTBOUND" },
            });
          }

          if (remaining > 0) {
            const batches = await tx.batch.findMany({
              where: { poolId: line.poolId, outPoolCount: { gt: 0 } },
              orderBy: { createdAt: "desc" },
            });
            for (const source of batches) {
              if (remaining <= 0) break;
              const restore = Math.min(remaining, source.outPoolCount);
              remaining -= restore;
              await tx.batch.update({
                where: { id: source.id },
                data: { outPoolCount: { decrement: restore }, status: "PARTIALLY_OUTBOUND" },
              });
            }
          }

          if (remaining < line.count) {
            await tx.holdingPool.update({
              where: { id: line.poolId },
              data: {
                currentGender: line.gender,
                currentWeightTier: Invariants.normalizeWeightTier(line.weightTier),
              },
            });
          }
        }
      }

      if (batch.status === "COMPLETED" && batch.tagClaimId) {
        const claim = await tx.tagClaim.findUnique({ where: { id: batch.tagClaimId } });
        if (claim) {
          const newBound = Math.max(0, claim.boundCount - batch.qualifiedCount);
          const newScrapped = Math.max(0, claim.scrappedCount - batch.lossCount);
          await tx.tagClaim.update({
            where: { id: claim.id },
            data: {
              boundCount: newBound,
              scrappedCount: newScrapped,
              isBalanced: claim.claimCount === (newBound + claim.returnedCount + newScrapped),
            },
          });
        }
      }

      await tx.bundleBatch.delete({ where: { id: bundleId } });

      const remainingBundling = await tx.bundleBatch.count({
        where: { groupId: batch.groupId, status: "BUNDLING" },
      });
      if (remainingBundling === 0) {
        await tx.bundleGroup.update({
          where: { id: batch.groupId },
          data: { status: "IDLE" },
        });
      }
    });

    revalidate("/bundling");
    revalidate("/sorting");
    revalidate("/pools");
    revalidate("/batches");
    revalidate("/");
    return { success: true, message: `捆扎批次 ${batch.code} 已成功撤销并作废，暂养池库存已原数恢复` };
  } catch (error: any) {
    console.error("deleteBundleBatchAction error:", error);
    return { success: false, message: error.message || "撤销捆扎批次失败" };
  }
}


// ============================================================================
// 3. 分拣称重 Server Actions
// ============================================================================

export async function createSortTasksAction(data: {
  machineId: string;
  bundleBatchId: string;
  items: Array<{
    lineId: string;
    gender: string;
    weightTier: string;
    inputCount: number;
  }>;
}) {
  try {
    if (!data.items || data.items.length === 0) {
      return { success: false, message: "请至少选择一个分规规格明细" };
    }

    const machine = await prisma.sortMachine.findUnique({ where: { id: data.machineId } });
    if (!machine || machine.status !== "ACTIVE") {
      return { success: false, message: "分拣设备未启用或不存在" };
    }
    if (machine.lastCalibrationStatus === "EXCEPTION") {
      return { success: false, message: "设备校准未通过，安全联锁启动，禁止开机作业" };
    }

    const createdCodes: string[] = [];

    await prisma.$transaction(async (tx) => {
      const bundle = await tx.bundleBatch.findUnique({
        where: { id: data.bundleBatchId },
        include: {
          lines: true,
          sortTasks: true,
          sourceBatch: { select: { id: true, code: true, inPoolTime: true } },
        },
      });
      if (!bundle || bundle.status !== "COMPLETED") throw new Error("只有【已完成】的捆扎批次才允许进入分拣任务");
      if (!bundle.sourceBatchId || !bundle.sourceBatch) throw new Error("该捆扎批次缺少原料批次来源，禁止进入分拣任务");
      const sourceBatchId = bundle.sourceBatchId;
      const sourceBatch = bundle.sourceBatch;

      // 规格余量校验与创建任务处于同一事务，避免并发超额建单。
      const specUsedMap = new Map<string, number>();
      for (const task of bundle.sortTasks) {
        const key = `${task.gender}_${Invariants.normalizeWeightTier(task.weightTier)}`;
        specUsedMap.set(key, (specUsedMap.get(key) || 0) + task.inputCount);
      }
      const specLineTotals = new Map<string, number>();
      for (const line of bundle.lines) {
        const key = `${line.gender}_${Invariants.normalizeWeightTier(line.weightTier)}`;
        specLineTotals.set(key, (specLineTotals.get(key) || 0) + (line.qualifiedCount ?? line.count));
      }
      const submittedLineIds = new Set<string>();
      for (const item of data.items) {
        const line = bundle.lines.find((candidate) => candidate.id === item.lineId);
        if (!line) throw new Error("所选分拣规格明细不属于当前捆扎批次，请刷新后重试");
        if (submittedLineIds.has(item.lineId)) throw new Error("同一分拣规格明细不能重复提交");
        submittedLineIds.add(item.lineId);

        const normTier = Invariants.normalizeWeightTier(item.weightTier);
        if (
          line.gender !== item.gender ||
          Invariants.normalizeWeightTier(line.weightTier) !== normTier
        ) {
          throw new Error("分拣规格明细与提交的公母/规格不一致，请刷新后重试");
        }

        const specKey = `${item.gender}_${normTier}`;
        const alreadySorted = specUsedMap.get(specKey) || 0;
        const check = Invariants.checkSortTaskIntake({
          bundleLineCount: specLineTotals.get(specKey) || 0,
          alreadySortedCount: alreadySorted,
          inputCount: item.inputCount,
          bundleStatus: bundle.status,
          bundleCode: bundle.code,
          spec: `${item.gender === "FEMALE" ? "母蟹" : "公蟹"} ${normTier}`,
        });
        if (!check.valid) throw new Error(check.reason);
        specUsedMap.set(specKey, alreadySorted + item.inputCount);
      }

      // 分拣阶段继续执行原料批次 FIFO：更早批次即使仍在捆扎，也不能被后续原料批次跨越。
      const fifoBundles = await tx.bundleBatch.findMany({
        where: { status: { in: ["BUNDLING", "COMPLETED"] }, sourceBatchId: { not: null } },
        select: {
          status: true,
          qualifiedCount: true,
          sourceBatch: { select: { id: true, code: true, inPoolTime: true } },
          sortTasks: { select: { inputCount: true } },
        },
      });

      const unfinishedSources = new Map<string, { id: string; code: string; inPoolTime: Date }>();
      for (const candidate of fifoBundles) {
        const source = candidate.sourceBatch;
        if (!source) continue;
        const availableCount = candidate.status === "COMPLETED"
          ? candidate.qualifiedCount - candidate.sortTasks.reduce((sum, task) => sum + task.inputCount, 0)
          : 0;
        if (candidate.status === "BUNDLING" || availableCount > 0) {
          unfinishedSources.set(source.id, source);
        }
      }

      const oldestSource = [...unfinishedSources.values()].sort((a, b) => {
        const timeDiff = a.inPoolTime.getTime() - b.inPoolTime.getTime();
        return timeDiff || a.code.localeCompare(b.code);
      })[0];

      if (oldestSource?.id !== sourceBatchId) {
        throw new Error(
          oldestSource
            ? `请先处理更早入池的原料批次 ${oldestSource.code}，当前批次 ${sourceBatch.code} 暂不可分拣`
            : "当前没有可进入分拣的原料批次"
        );
      }

      // FJR 继承原料批次核心编码；同一原料批次无论拆成多少捆扎批次，都共用 -1、-2……序列。
      const sourceCoreCode = sourceBatch.code.replace(/^(YL|PC)-?/, "").replace(/-/g, "");
      const baseCode = `FJR${sourceCoreCode}`;
      const existingTasks = await tx.sortTask.findMany({
        where: { bundleBatch: { sourceBatchId } },
        select: { id: true, code: true },
        orderBy: { createdAt: "asc" },
      });

      const unsuffixed = existingTasks.find((task) => task.code === baseCode);
      const hasFirstSuffix = existingTasks.some((task) => task.code === `${baseCode}-1`);
      if (existingTasks.length + data.items.length > 1 && unsuffixed && !hasFirstSuffix) {
        const downstream = await tx.coldLog.findFirst({
          where: {
            refType: "SORT",
            refId: { in: [unsuffixed.id, baseCode] },
          },
          select: { id: true },
        });
        if (downstream) {
          throw new Error(`分拣批次 ${baseCode} 已进入保鲜预冷，禁止再追加同原料批次的分拣任务`);
        }
        await tx.sortTask.update({ where: { id: unsuffixed.id }, data: { code: `${baseCode}-1` } });
        unsuffixed.code = `${baseCode}-1`;
      }

      let maxSuffix = existingTasks.reduce((max, task) => {
        if (!task.code.startsWith(`${baseCode}-`)) return max;
        const suffix = Number(task.code.slice(baseCode.length + 1));
        return Number.isInteger(suffix) ? Math.max(max, suffix) : max;
      }, 0);

      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        const code = existingTasks.length === 0 && data.items.length === 1
          ? baseCode
          : `${baseCode}-${++maxSuffix}`;
        await tx.sortTask.create({
          data: {
            code,
            machineId: data.machineId,
            bundleBatchId: data.bundleBatchId,
            gender: item.gender,
            weightTier: Invariants.normalizeWeightTier(item.weightTier),
            inputCount: item.inputCount,
            status: "PENDING",
          },
        });
        createdCodes.push(code);
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidate("/sorting");
    revalidate("/");
    return {
      success: true,
      codes: createdCodes,
      message: `成功创建 ${createdCodes.length} 笔分拣任务 (${createdCodes.join("、")})，等待上机称重`,
    };
  } catch (error: any) {
    console.error("createSortTasksAction error:", error);
    return { success: false, message: error.message || "批量创建分拣任务失败" };
  }
}

export async function completeSortTaskAction(taskId: string, qualifiedCount: number) {
  try {
    const task = await prisma.sortTask.findUnique({ where: { id: taskId } });
    if (!task) return { success: false, message: "分拣任务未找到" };

    const lossRes = Invariants.calculateSortingLoss({
      inputCount: task.inputCount,
      qualifiedCount,
    });

    if (!lossRes.valid) {
      return { success: false, message: lossRes.reason };
    }

    await prisma.sortTask.update({
      where: { id: taskId },
      data: {
        qualifiedCount,
        lossCount: lossRes.lossCount,
        lossRate: lossRes.lossRate,
        status: "COMPLETED",
        doneAt: new Date(),
      },
    });

    revalidate("/sorting");
    revalidate("/cold-storage");
    revalidate("/outbound");
    revalidate("/");
    return {
      success: true,
      isException: lossRes.isException,
      message: `分拣任务已完成！合格入库 ${qualifiedCount} 只，损耗 ${lossRes.lossCount} 只（${lossRes.lossRate}%）`,
    };
  } catch (error: any) {
    console.error("completeSortTaskAction error:", error);
    return { success: false, message: error.message || "完成分拣任务失败" };
  }
}

export async function deleteSortTaskAction(taskId: string) {
  try {
    const task = await prisma.sortTask.findUnique({ where: { id: taskId } });
    if (!task) return { success: false, message: "分拣任务未找到" };

    const coldLog = await prisma.coldLog.findFirst({
      where: { refId: task.code },
      include: { outboundOrders: true },
    });
    if (coldLog && coldLog.outboundOrders.length > 0) {
      return {
        success: false,
        message: `该分拣任务已被冷库记录 (${coldLog.code}) 关联并参与出库 (${coldLog.outboundOrders[0].code})，无法直接撤回`,
      };
    }
    if (coldLog) {
      await prisma.coldLog.delete({ where: { id: coldLog.id } });
    }

    await prisma.sortTask.delete({ where: { id: taskId } });

    revalidate("/sorting");
    revalidate("/cold-storage");
    revalidate("/outbound");
    revalidate("/");
    return { success: true, message: `分拣任务 ${task.code} 已成功撤回删除` };
  } catch (error: any) {
    console.error("deleteSortTaskAction error:", error);
    return { success: false, message: error.message || "撤销分拣任务失败" };
  }
}

export async function calibrateMachineAction(machineId: string, status: "QUALIFIED" | "EXCEPTION" | "PENDING") {
  try {
    await prisma.sortMachine.update({
      where: { id: machineId },
      data: {
        lastCalibratedAt: new Date(),
        lastCalibrationStatus: status,
      },
    });
    revalidate("/sorting");
    revalidate("/");
    const label = status === "QUALIFIED" ? "合格" : status === "EXCEPTION" ? "异常" : "待校验";
    return { success: true, message: `设备校准状态已更新为【${label}】` };
  } catch (error: any) {
    return { success: false, message: error.message || "校准状态更新失败" };
  }
}

export async function createSortMachineAction(name: string) {
  try {
    const count = await prisma.sortMachine.count();
    const code = `FJ-${String(count + 1).padStart(2, "0")}`;
    await prisma.sortMachine.create({
      data: {
        code,
        name: name.trim() || `分拣机 ${count + 1}`,
        status: "ACTIVE",
        lastCalibrationStatus: "QUALIFIED",
        lastCalibratedAt: new Date(),
      },
    });
    revalidate("/sorting");
    return { success: true, message: `分拣机 ${name} (${code}) 创建成功` };
  } catch (error: any) {
    return { success: false, message: error.message || "创建分拣机失败" };
  }
}

export async function updateSortMachineNameAction(machineId: string, name: string) {
  try {
    if (!name.trim()) return { success: false, message: "分拣机名称不能为空" };
    await prisma.sortMachine.update({
      where: { id: machineId },
      data: { name: name.trim() },
    });
    revalidate("/sorting");
    return { success: true, message: "分拣机名称已更新" };
  } catch (error: any) {
    return { success: false, message: error.message || "更新失败" };
  }
}

export async function toggleSortMachineStatusAction(machineId: string) {
  try {
    const m = await prisma.sortMachine.findUnique({ where: { id: machineId } });
    if (!m) return { success: false, message: "设备未找到" };
    const nextStatus = m.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await prisma.sortMachine.update({
      where: { id: machineId },
      data: { status: nextStatus },
    });
    revalidate("/sorting");
    return { success: true, message: `设备已${nextStatus === "ACTIVE" ? "启用" : "停用"}` };
  } catch (error: any) {
    return { success: false, message: error.message || "切换状态失败" };
  }
}

export async function deleteSortMachineAction(machineId: string) {
  try {
    const taskCount = await prisma.sortTask.count({ where: { machineId } });
    if (taskCount > 0) {
      return { success: false, message: "该分拣设备名下存在历史分拣任务，禁止删除！" };
    }
    await prisma.sortMachine.delete({ where: { id: machineId } });
    revalidate("/sorting");
    return { success: true, message: "分拣机已删除" };
  } catch (error: any) {
    return { success: false, message: error.message || "删除失败" };
  }
}


// ============================================================================
// 4. 保鲜预冷 Server Actions
// ============================================================================

export async function createColdIntakeAction(data: {
  storeId: string;
  count: number;
  sortTaskId: string;
  operator: string;
}) {
  try {
    if (!data.storeId) return { success: false, message: "请选择目标保鲜库" };
    if (!data.count || data.count <= 0) return { success: false, message: "入库只数必须大于 0" };
    if (!data.sortTaskId) return { success: false, message: "必须选择关联的分拣批次任务" };

    const result = await prisma.$transaction(async (tx) => {
      const sortTask = await tx.sortTask.findUnique({
        where: { id: data.sortTaskId },
        include: {
          bundleBatch: {
            select: {
              sourceBatchId: true,
              sourceBatch: { select: { id: true, code: true, inPoolTime: true } },
            },
          },
        },
      });

      if (!sortTask) {
        throw new Error("未找到关联的分拣批次任务，请重新选择");
      }

      const sourceBatch = sortTask.bundleBatch.sourceBatch;
      if (!sortTask.bundleBatch.sourceBatchId || !sourceBatch) {
        throw new Error("该分拣批次缺少原料批次来源，禁止进入预冷入库");
      }

      // 保鲜预冷也按原料入池时间执行 FIFO：前序原料只要仍在捆扎、待分拣、待完成分拣或待入库，
      // 后序原料都不能抢先进入冷库。
      const pipelineBundles = await tx.bundleBatch.findMany({
        where: { status: { in: ["BUNDLING", "COMPLETED"] } },
        select: {
          status: true,
          qualifiedCount: true,
          sourceBatch: { select: { id: true, code: true, inPoolTime: true } },
          sortTasks: {
            select: {
              id: true,
              code: true,
              status: true,
              inputCount: true,
              qualifiedCount: true,
            },
          },
        },
      });

      const allTasks = pipelineBundles.flatMap((bundle) => bundle.sortTasks);
      const taskIds = allTasks.map((task) => task.id);
      const taskRefs = allTasks.flatMap((task) => [task.id, task.code]);
      const taskByRef = new Map(allTasks.flatMap((task) => [[task.id, task.id], [task.code, task.id]]));
      const intakeLogs = taskIds.length > 0
        ? await tx.coldLog.findMany({
            where: {
              type: "INTAKE",
              OR: [
                { sortTaskId: { in: taskIds } },
                { sortTaskId: null, refId: { in: taskRefs } },
              ],
            },
            select: { sortTaskId: true, refId: true, count: true },
          })
        : [];
      const intakeByTask = new Map<string, number>();
      for (const log of intakeLogs) {
        const taskId = log.sortTaskId || (log.refId ? taskByRef.get(log.refId) : undefined);
        if (!taskId) continue;
        intakeByTask.set(taskId, (intakeByTask.get(taskId) || 0) + log.count);
      }

      const unfinishedSources = new Map<string, { id: string; code: string; inPoolTime: Date }>();
      for (const bundle of pipelineBundles) {
        const source = bundle.sourceBatch;
        if (!source) continue;

        let unfinished = bundle.status === "BUNDLING";
        if (!unfinished) {
          const assignedToSort = bundle.sortTasks.reduce((sum, task) => sum + task.inputCount, 0);
          if (assignedToSort < bundle.qualifiedCount) unfinished = true;
        }
        if (!unfinished) {
          unfinished = bundle.sortTasks.some((task) => {
            if (task.status !== "COMPLETED") return true;
            return (intakeByTask.get(task.id) || 0) < task.qualifiedCount;
          });
        }
        if (unfinished) unfinishedSources.set(source.id, source);
      }

      const oldestSource = [...unfinishedSources.values()].sort((a, b) => {
        const timeDiff = a.inPoolTime.getTime() - b.inPoolTime.getTime();
        return timeDiff || a.code.localeCompare(b.code);
      })[0];
      if (oldestSource?.id !== sourceBatch.id) {
        throw new Error(
          oldestSource
            ? `请先处理更早入池的原料批次 ${oldestSource.code}，当前批次 ${sourceBatch.code} 暂不可预冷入库`
            : "当前没有可预冷入库的原料批次"
        );
      }

      // 同一事务内统计已入库数量，避免并发请求同时通过余量校验。
      const logAgg = await tx.coldLog.aggregate({
        where: {
          type: "INTAKE",
          OR: [
            { sortTaskId: sortTask.id },
            { sortTaskId: null, refId: { in: [sortTask.id, sortTask.code] } },
          ],
        },
        _sum: { count: true },
      });
      const alreadyIntakeCount = logAgg._sum.count || 0;

      const checkRes = Invariants.checkColdIntake({
        qualifiedCount: sortTask.qualifiedCount,
        alreadyIntakeCount,
        intakeCount: data.count,
        taskStatus: sortTask.status,
        taskCode: sortTask.code,
      });
      if (!checkRes.valid) throw new Error(checkRes.reason);

      const count = await tx.coldLog.count();
      const code = `CR-${String(count + 901).padStart(4, "0")}`;
      await tx.coldLog.create({
        data: {
          code,
          storeId: data.storeId,
          type: "INTAKE",
          count: data.count,
          sortTaskId: sortTask.id,
          operator: data.operator || "李仓管",
        },
      });

      return { code, taskCode: sortTask.code };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidate("/cold-storage");
    revalidate("/sorting");
    revalidate("/outbound");
    revalidate("/");
    return {
      success: true,
      code: result.code,
      message: `分拣批次 [${result.taskCode}] 预冷入库登记成功（入库 ${data.count} 只，生成单号 ${result.code}）`,
    };
  } catch (error: any) {
    console.error("createColdIntakeAction error:", error);
    return { success: false, message: error.message || "预冷入库登记失败" };
  }
}

export async function createColdStoreAction(data: { name: string }) {
  try {
    const count = await prisma.coldStore.count();
    const code = `BX-${String(count + 1).padStart(2, "0")}`;
    await prisma.coldStore.create({
      data: {
        code,
        name: data.name.trim(),
      },
    });
    revalidate("/cold-storage");
    return { success: true, message: `保鲜库位 ${data.name} (${code}) 创建成功` };
  } catch (error: any) {
    return { success: false, message: error.message || "创建保鲜库位失败" };
  }
}

export async function updateColdStoreAction(storeId: string, data: { name: string }) {
  try {
    if (!data.name.trim()) return { success: false, message: "库位名称不能为空" };
    await prisma.coldStore.update({
      where: { id: storeId },
      data: {
        name: data.name.trim(),
      },
    });
    revalidate("/cold-storage");
    return { success: true, message: "保鲜库位信息已更新" };
  } catch (error: any) {
    return { success: false, message: error.message || "更新保鲜库位失败" };
  }
}

export async function deleteColdStoreAction(storeId: string) {
  try {
    const logCount = await prisma.coldLog.count({ where: { storeId } });
    if (logCount > 0) {
      return { success: false, message: "该保鲜库名下存在入库台账存量，禁止删除" };
    }
    await prisma.coldStore.delete({ where: { id: storeId } });
    revalidate("/cold-storage");
    return { success: true, message: "保鲜库位已删除" };
  } catch (error: any) {
    return { success: false, message: error.message || "删除保鲜库位失败" };
  }
}
