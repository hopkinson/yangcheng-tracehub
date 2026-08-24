"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createChannelAction(data: { code: string; name: string; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);

  const cleanCode = data.code.trim().toUpperCase();
  const cleanName = data.name.trim();

  const existing = await prisma.channel.findUnique({
    where: { code: cleanCode },
  });
  if (existing) {
    throw new Error(`渠道编码【${cleanCode}】已存在，请使用其他编码`);
  }

  const channel = await prisma.channel.create({
    data: {
      code: cleanCode,
      name: cleanName,
    },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "CREATE_CHANNEL",
      entityType: "CHANNEL",
      entityId: channel.id,
      details: JSON.stringify({ code: channel.code, name: channel.name }),
    },
  });

  revalidatePath("/stores");
  revalidatePath("/users");
  return channel;
}

export async function deleteChannelAction(data: { id: string; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);

  const [storeCount, userCount, orderCount] = await Promise.all([
    prisma.store.count({ where: { channelId: data.id } }),
    prisma.user.count({ where: { channelId: data.id } }),
    prisma.outboundOrder.count({ where: { channelId: data.id } }),
  ]);

  if (storeCount > 0 || userCount > 0 || orderCount > 0) {
    throw new Error(`该渠道已关联 ${storeCount} 家门店、${orderCount} 条出库单、${userCount} 个账号，禁止删除！`);
  }

  const channel = await prisma.channel.delete({
    where: { id: data.id },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "DELETE_CHANNEL",
      entityType: "CHANNEL",
      entityId: channel.id,
      details: JSON.stringify({ code: channel.code, name: channel.name }),
    },
  });

  revalidatePath("/stores");
  revalidatePath("/users");
  return channel;
}
