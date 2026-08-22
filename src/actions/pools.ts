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
