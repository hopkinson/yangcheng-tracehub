"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { safeRevalidate } from "@/lib/revalidate";
import { storeFormSchema } from "@/lib/validations/schemas";

const revalidateStores = () => ["/stores", "/outbound"].forEach(safeRevalidate);

export async function createStoreAction(data: { code: string; name: string; channelId: string; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);

  const parsed = storeFormSchema.safeParse({ code: data.code, name: data.name, channelId: data.channelId, isActive: true });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "门店信息格式不正确" };

  const code = parsed.data.code.toUpperCase();
  const name = parsed.data.name;

  const channel = await prisma.channel.findUnique({ where: { id: parsed.data.channelId }, select: { id: true } });
  if (!channel) return { error: "所选销售渠道不存在，请重新选择" };

  const duplicate = await prisma.store.findFirst({
    where: { OR: [{ code }, { name }] },
    select: { code: true },
  });
  if (duplicate) return { error: duplicate.code === code ? `门店编号「${code}」已存在，请更换` : `门店全称「${name}」已存在，请更换` };

  const store = await prisma.store.create({
    data: { code, name, channelId: parsed.data.channelId, isActive: true },
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

  revalidateStores();
  return { store };
}

export async function updateStoreAction(data: { id: string; code: string; name: string; channelId: string; isActive: boolean; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);

  const parsed = storeFormSchema.safeParse({ code: data.code, name: data.name, channelId: data.channelId, isActive: data.isActive });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "门店信息格式不正确" };

  const code = parsed.data.code.toUpperCase();
  const name = parsed.data.name;

  const existingStore = await prisma.store.findUnique({ where: { id: data.id }, select: { id: true } });
  if (!existingStore) return { error: "指定门店档案不存在或已被删除" };

  const channel = await prisma.channel.findUnique({ where: { id: parsed.data.channelId }, select: { id: true } });
  if (!channel) return { error: "所选销售渠道不存在，请重新选择" };

  const duplicate = await prisma.store.findFirst({
    where: { id: { not: data.id }, OR: [{ code }, { name }] },
    select: { code: true },
  });
  if (duplicate) return { error: duplicate.code === code ? `门店编号「${code}」已存在，请更换` : `门店全称「${name}」已存在，请更换` };

  const store = await prisma.store.update({
    where: { id: data.id },
    data: { code, name, channelId: parsed.data.channelId, isActive: parsed.data.isActive },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "UPDATE_STORE",
      entityType: "STORE",
      entityId: store.id,
      details: JSON.stringify({ code: store.code, name: store.name, channelId: store.channelId, isActive: store.isActive }),
    },
  });

  revalidateStores();
  return { store };
}

export async function deleteStoreAction(data: { id: string; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);
  const store = await prisma.store.findUnique({
    where: { id: data.id },
    include: { outboundOrders: true },
  });

  if (!store) return { error: "未找到指定门店" };
  if (store.outboundOrders.length > 0) {
    return { error: `门店【${store.name}】已有出库记录，无法删除，可设为停用` };
  }

  await prisma.store.delete({ where: { id: data.id } });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "DELETE_STORE",
      entityType: "STORE",
      entityId: store.id,
      details: JSON.stringify({ code: store.code, name: store.name }),
    },
  });

  revalidateStores();
  return { success: true };
}
