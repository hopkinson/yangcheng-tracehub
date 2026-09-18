"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { channelFormSchema } from "@/lib/validations/schemas";

export async function createChannelAction(data: { name: string; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);

  const cleanName = data.name.trim();

  const existing = await prisma.channel.findUnique({
    where: { name: cleanName },
  });
  if (existing) {
    throw new Error(`渠道名称【${cleanName}】已存在，请使用其他名称`);
  }

  const channel = await prisma.channel.create({
    data: {
      name: cleanName,
    },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "CREATE_CHANNEL",
      entityType: "CHANNEL",
      entityId: channel.id,
      details: JSON.stringify({ name: channel.name }),
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
      details: JSON.stringify({ name: channel.name }),
    },
  });

  revalidatePath("/stores");
  revalidatePath("/users");
  return channel;
}

export async function updateChannelAction(data: { id: string; name: string; userId: string }) {
  await requireRole(["WAREHOUSE_ADMIN", "ADMIN"]);

  const parsed = channelFormSchema.safeParse({ name: data.name });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "渠道名称不合法");
  }
  const cleanName = parsed.data.name;

  const [existing, oldChannel] = await Promise.all([
    prisma.channel.findUnique({ where: { name: cleanName } }),
    prisma.channel.findUnique({ where: { id: data.id } }),
  ]);
  if (!oldChannel) throw new Error("该销售渠道不存在或已被删除");
  if (existing && existing.id !== data.id) throw new Error(`渠道名称【${cleanName}】已存在，请使用其他名称`);
  if (oldChannel.name === cleanName) return oldChannel;

  const channel = await prisma.channel.update({
    where: { id: data.id },
    data: {
      name: cleanName,
    },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: data.userId,
      action: "UPDATE_CHANNEL",
      entityType: "CHANNEL",
      entityId: channel.id,
      details: JSON.stringify({ oldName: oldChannel.name, newName: channel.name }),
    },
  });

  revalidatePath("/stores");
  revalidatePath("/users");
  return channel;
}
