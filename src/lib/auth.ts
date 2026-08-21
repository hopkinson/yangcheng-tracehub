import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (session?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { channel: true },
    });
    if (user) return user;
  }

  // 兼容直接设置 current_user_id 的场景
  const currentUserId = cookieStore.get("current_user_id")?.value;
  if (currentUserId) {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: { channel: true },
    });
    if (user) return user;
  }

  // 默认管理员兜底
  const defaultAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    include: { channel: true },
  });
  return defaultAdmin!;
}
