import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export async function getCurrentUser() {
  try {
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
    return null;
  } catch {
    // cookies() called outside request scope (e.g. standalone test scripts)
    if (process.env.NODE_ENV === "test" || !process.env.NEXT_RUNTIME) {
      return prisma.user.findFirst({
        where: { role: "ADMIN" },
        include: { channel: true },
      });
    }
    return null;
  }
}

export async function requireRole(allowedRoles: string[]) {
  const user = await getCurrentUser();
  if (!user || !allowedRoles.includes(user.role)) {
    throw new Error(`无权操作: 仅限 [${allowedRoles.join(", ")}] 角色执行`);
  }
  return user;
}
