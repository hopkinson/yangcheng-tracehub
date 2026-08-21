"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/session";

export async function loginAction(formData: FormData) {
  const username = (formData.get("username") as string)?.trim();
  const password = (formData.get("password") as string)?.trim();
  const redirectUrl = (formData.get("redirect") as string)?.trim();

  const failRedirectBase = redirectUrl
    ? `/login?redirect=${encodeURIComponent(redirectUrl)}&error=`
    : "/login?error=";

  if (!username) {
    redirect(failRedirectBase + encodeURIComponent("请输入用户名"));
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: { channel: true },
  });

  if (!user || user.passwordHash !== (password || "123456")) {
    redirect(
      failRedirectBase +
        encodeURIComponent("用户名或密码错误 (默认初始密码: 123456)")
    );
  }

  const token = await createSessionToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);

  // 校验 redirectUrl 是否为合法站内路径，防止开放重定向漏洞
  const targetUrl =
    redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//")
      ? redirectUrl
      : "/";

  redirect(targetUrl);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

export async function switchUserAction(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return;

  const token = await createSessionToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
}
