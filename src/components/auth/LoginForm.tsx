"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2 } from "lucide-react";
import { loginAction } from "@/actions/auth";

export function LoginForm({
  initialError,
  initialRedirect,
}: {
  initialError?: string;
  initialRedirect?: string;
}) {
  const [error, setError] = useState(initialError || "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      try {
        await loginAction(formData);
      } catch (err: any) {
        if (err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith("NEXT_REDIRECT")) {
          return;
        }
        setError(err?.message || "登录失败，请检查用户名或密码");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3.5">
      {initialRedirect && <input type="hidden" name="redirect" value={initialRedirect} />}
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="username" className="text-xs font-medium">用户名 / 账号</Label>
        <Input
          id="username"
          name="username"
          placeholder="例如: admin / sams_auditor"
          defaultValue="admin"
          required
          disabled={isPending}
          className="h-9 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-xs font-medium">密码</Label>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="请输入登录密码"
          defaultValue="123456"
          required
          disabled={isPending}
          className="h-9 text-xs font-mono"
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full h-9 text-xs font-semibold mt-2">
        {isPending ? (
          <>
            <Loader2 className="size-3.5 mr-1 animate-spin" />
            正在登录...
          </>
        ) : (
          <>
            登录系统
            <ArrowRight className="size-3.5 ml-1" />
          </>
        )}
      </Button>
    </form>
  );
}
