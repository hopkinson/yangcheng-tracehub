"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const currentUserId = cookieStore.get("current_user_id")?.value;

  if (currentUserId) {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: { channel: true },
    });
    if (user) return user;
  }

  // 默认管理员
  const defaultAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    include: { channel: true },
  });
  return defaultAdmin!;
}

export async function switchUserAction(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set("current_user_id", userId, { path: "/", maxAge: 86400 * 30 });
}
