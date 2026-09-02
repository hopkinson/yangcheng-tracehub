"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createPoolAction(data: { name: string; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  const count = await prisma.holdingPool.count();
  const code = `ZY-${String(count + 1).padStart(2, "0")}`;

  const pool = await prisma.holdingPool.create({
    data: {
      code,
      name: data.name,
      status: "ACTIVE",
    },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "CREATE_POOL",
      entityType: "HOLDING_POOL",
      entityId: pool.id,
      details: JSON.stringify({ code: pool.code, name: pool.name }),
    },
  });

  revalidatePath("/pools");
  revalidatePath("/batches");
  return pool;
}

export async function updatePoolAction(data: { id: string; name: string; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  const pool = await prisma.holdingPool.update({
    where: { id: data.id },
    data: {
      name: data.name,
    },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "UPDATE_POOL",
      entityType: "HOLDING_POOL",
      entityId: pool.id,
      details: JSON.stringify({ name: pool.name }),
    },
  });

  revalidatePath("/pools");
  return pool;
}

export async function deletePoolAction(data: { id: string; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  const pool = await prisma.holdingPool.findUniqueOrThrow({
    where: { id: data.id },
    include: {
      batches: true,
    },
  });

  const activeLive = pool.batches
    .filter((b) => ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"].includes(b.status))
    .reduce((sum, b) => sum + (b.inPoolCount - b.outPoolCount - b.lossCount), 0);

  if (activeLive > 0) {
    throw new Error(`暂养池【${pool.name}】尚有在养活蟹 ${activeLive} 只，无法删除`);
  }

  if (pool.batches.length > 0) {
    throw new Error(`暂养池【${pool.name}】已有历史批次记录，无法删除`);
  }

  await prisma.holdingPool.delete({
    where: { id: data.id },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "DELETE_POOL",
      entityType: "HOLDING_POOL",
      entityId: pool.id,
      details: JSON.stringify({ code: pool.code, name: pool.name }),
    },
  });

  revalidatePath("/pools");
  revalidatePath("/batches");
}

export async function clearPoolAction(data: { poolId: string; reason: string; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  return await prisma.$transaction(async (tx) => {
    const pool = await tx.holdingPool.findUniqueOrThrow({
      where: { id: data.poolId },
      include: {
        batches: {
          where: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } },
          include: { lossRecords: true },
        },
        batchItems: {
          where: { batch: { status: { in: ["TEMPORARY_HOLDING", "PARTIALLY_OUTBOUND"] } } },
        },
      },
    });

    let totalClearedCrabs = 0;

    for (const b of pool.batches) {
      const live = b.inPoolCount - b.outPoolCount - b.lossCount;
      const cumulativeLoss = b.lossCount + Math.max(0, live);
      if (live > 0) {
        totalClearedCrabs += live;
        await tx.lossRecord.create({
          data: {
            batchId: b.id,
            bookInPool: live,
            physicalCount: 0,
            lossCount: live,
            cumulativeLoss,
            lossRate: b.inPoolCount > 0 ? Number(((cumulativeLoss / b.inPoolCount) * 100).toFixed(2)) : 0,
            reason: data.reason || "批次出库完毕，清池盘点结算归零",
            inspectorId: data.userId,
          },
        });
      }
      await tx.batch.update({ where: { id: b.id }, data: { lossCount: cumulativeLoss, status: "COMPLETED" } });
    }

    for (const item of pool.batchItems) {
      const itemLive = item.inPoolCount - item.outPoolCount - item.lossCount;
      if (itemLive > 0) {
        await tx.batchItem.update({ where: { id: item.id }, data: { lossCount: item.inPoolCount - item.outPoolCount } });
      }
    }

    // 3. 解绑暂养池规格锁定
    const updatedPool = await tx.holdingPool.update({
      where: { id: pool.id },
      data: {
        currentGender: null,
        currentWeightTier: null,
      },
    });

    // 4. 审计留痕
    await tx.auditLog.create({
      data: {
        operatorId: data.userId,
        action: "CLEAR_POOL",
        entityType: "HOLDING_POOL",
        entityId: pool.id,
        details: JSON.stringify({
          poolCode: pool.code,
          poolName: pool.name,
          clearedCrabs: totalClearedCrabs,
          reason: data.reason,
        }),
      },
    });

    revalidatePath("/pools");
    revalidatePath("/batches");
    revalidatePath("/ledgers");
    revalidatePath("/");

    return { success: true, pool: updatedPool, clearedCrabs: totalClearedCrabs };
  });
}

