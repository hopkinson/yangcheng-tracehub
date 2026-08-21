"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createUserAction(data: {
  username: string;
  fullName: string;
  role: string;
  channelId?: string;
  password?: string;
  operatorId?: string;
}) {
  const username = data.username.trim();
  const fullName = data.fullName.trim();
  const role = data.role;
  const channelId = role === "CHANNEL_VIEWER" ? data.channelId || null : null;
  const passwordHash = data.password?.trim() || "123456";

  if (!username || !fullName || !role) {
    throw new Error("用户名、姓名和角色均为必填项");
  }

  if (role === "CHANNEL_VIEWER" && !channelId) {
    throw new Error("渠道人员角色必须绑定所属销售渠道！");
  }

  const existing = await prisma.user.findUnique({
    where: { username },
  });
  if (existing) {
    throw new Error(`用户名 "${username}" 已被占用，请更换`);
  }

  const user = await prisma.user.create({
    data: {
      username,
      fullName,
      role,
      channelId,
      passwordHash,
    },
  });

  if (data.operatorId) {
    await prisma.auditLog.create({
      data: {
        operatorId: data.operatorId,
        action: "CREATE_USER",
        entityType: "USER",
        entityId: user.id,
        details: JSON.stringify({ username, fullName, role, channelId }),
      },
    });
  }

  revalidatePath("/users");
  return user;
}

export async function updateUserAction(data: {
  id: string;
  fullName: string;
  role: string;
  channelId?: string;
  operatorId?: string;
}) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: data.id },
  });

  const channelId = data.role === "CHANNEL_VIEWER" ? data.channelId || null : null;

  if (data.role === "CHANNEL_VIEWER" && !channelId) {
    throw new Error("渠道人员角色必须绑定所属销售渠道！");
  }

  // 保护：如果将系统中唯一的超级管理员降级，则拦截
  if (user.role === "ADMIN" && data.role !== "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      throw new Error("系统必须保留至少一位超级管理员，无法变更该用户角色");
    }
  }

  const updated = await prisma.user.update({
    where: { id: data.id },
    data: {
      fullName: data.fullName.trim(),
      role: data.role,
      channelId,
    },
  });

  if (data.operatorId) {
    await prisma.auditLog.create({
      data: {
        operatorId: data.operatorId,
        action: "UPDATE_USER",
        entityType: "USER",
        entityId: updated.id,
        details: JSON.stringify({
          prev: { fullName: user.fullName, role: user.role, channelId: user.channelId },
          next: { fullName: updated.fullName, role: updated.role, channelId: updated.channelId },
        }),
      },
    });
  }

  revalidatePath("/users");
  return updated;
}

export async function resetPasswordAction(data: {
  id: string;
  newPassword?: string;
  operatorId?: string;
}) {
  const newPassword = data.newPassword?.trim() || "123456";
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: data.id },
  });

  const updated = await prisma.user.update({
    where: { id: data.id },
    data: { passwordHash: newPassword },
  });

  if (data.operatorId) {
    await prisma.auditLog.create({
      data: {
        operatorId: data.operatorId,
        action: "RESET_PASSWORD",
        entityType: "USER",
        entityId: updated.id,
        details: JSON.stringify({ username: user.username }),
      },
    });
  }

  return { success: true, username: user.username };
}

export async function deleteUserAction(data: {
  id: string;
  operatorId?: string;
}) {
  if (data.operatorId && data.id === data.operatorId) {
    throw new Error("安全拦截：禁止删除当前登录的自身账号！");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: data.id },
    include: {
      _count: {
        select: {
          createdBatches: true,
          tagClaims: true,
          approvedClaims: true,
          outboundOrders: true,
          approvedOrders: true,
        },
      },
    },
  });

  if (user.role === "ADMIN" && (await prisma.user.count({ where: { role: "ADMIN" } })) <= 1) {
    throw new Error("系统必须保留至少一位超级管理员，禁止删除！");
  }

  if (Object.values(user._count).some((c) => c > 0)) {
    throw new Error("该用户名下存在关联的批次、蟹扣或出库单等业务流水记录，禁止物理删除！");
  }

  await prisma.user.delete({
    where: { id: data.id },
  });

  if (data.operatorId) {
    await prisma.auditLog.create({
      data: {
        operatorId: data.operatorId,
        action: "DELETE_USER",
        entityType: "USER",
        entityId: data.id,
        details: JSON.stringify({ username: user.username, fullName: user.fullName }),
      },
    });
  }

  revalidatePath("/users");
  return { success: true };
}
