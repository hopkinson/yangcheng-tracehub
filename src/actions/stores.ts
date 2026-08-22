"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createStoreAction(data: { name: string; channelId: string; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  const count = await prisma.store.count();
  const code = `ST-${String(count + 1).padStart(2, "0")}`;

  const store = await prisma.store.create({
    data: {
      code,
      name: data.name,
      channelId: data.channelId,
      isActive: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "CREATE_STORE",
      entityType: "STORE",
      entityId: store.id,
      details: JSON.stringify({ code: store.code, name: store.name, channelId: store.channelId }),
    },
  });

  revalidatePath("/stores");
  revalidatePath("/outbound");
  return store;
}

export async function updateStoreAction(data: { id: string; name: string; channelId: string; isActive: boolean; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  const store = await prisma.store.update({
    where: { id: data.id },
    data: {
      name: data.name,
      channelId: data.channelId,
      isActive: data.isActive,
    },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "UPDATE_STORE",
      entityType: "STORE",
      entityId: store.id,
      details: JSON.stringify({ name: store.name, channelId: store.channelId, isActive: store.isActive }),
    },
  });

  revalidatePath("/stores");
  revalidatePath("/outbound");
  return store;
}

export async function deleteStoreAction(data: { id: string; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  const store = await prisma.store.findUniqueOrThrow({
    where: { id: data.id },
    include: { outboundOrders: true },
  });

  if (store.outboundOrders.length > 0) {
    throw new Error(`门店【${store.name}】已有出库记录，无法删除，可设为停用`);
  }

  await prisma.store.delete({
    where: { id: data.id },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "DELETE_STORE",
      entityType: "STORE",
      entityId: store.id,
      details: JSON.stringify({ code: store.code, name: store.name }),
    },
  });

  revalidatePath("/stores");
  revalidatePath("/outbound");
}
