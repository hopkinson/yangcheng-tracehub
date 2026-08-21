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
  const phone = (formData.get("phone") as string)?.trim();
  const password = (formData.get("password") as string)?.trim();
  const redirectUrl = (formData.get("redirect") as string)?.trim();

  const failRedirectBase = redirectUrl
    ? `/login?redirect=${encodeURIComponent(redirectUrl)}&error=`
    : "/login?error=";

  if (!phone) {
    redirect(failRedirectBase + encodeURIComponent("请输入手机号"));
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    include: { channel: true },
  });

  if (!user || user.passwordHash !== password) {
    redirect(
      failRedirectBase +
        encodeURIComponent("手机号或密码错误 (初始密码为手机号后6位)")
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

export async function changePasswordAction(data: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const { userId, currentPassword, newPassword, confirmPassword } = data;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new Error("所有密码字段均为必填");
  }

  if (newPassword.length < 6) {
    throw new Error("新密码长度不能少于 6 位");
  }

  if (newPassword !== confirmPassword) {
    throw new Error("两次输入的新密码不一致");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });

  if (user.passwordHash !== currentPassword) {
    throw new Error("原密码输入错误");
  }

  if (currentPassword === newPassword) {
    throw new Error("新密码不能与原密码相同");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPassword },
  });

  await prisma.auditLog.create({
    data: {
      operatorId: userId,
      action: "CHANGE_PASSWORD",
      entityType: "USER",
      entityId: userId,
      details: JSON.stringify({ message: "用户自主修改密码" }),
    },
  });

  return { success: true };
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
