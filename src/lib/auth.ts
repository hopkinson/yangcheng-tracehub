import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    const session = await verifySessionToken(sessionToken);
    if (session?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        include: { channel: true },
      });
      if (user) return user;
    }
  }

  return null;
}

