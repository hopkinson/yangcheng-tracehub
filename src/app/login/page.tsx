"use client";

import { use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/actions/auth";
import { ArrowRight } from "lucide-react";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = use(searchParams);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground text-base font-black shadow-md tracking-tighter">
            YC
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            阳澄大闸蟹溯源品控系统
          </h1>
          <p className="text-xs text-muted-foreground">
            数量闭环管控与山姆渠道合规证明平台
          </p>
        </div>

        <Card className="border-border/70 bg-card/85 backdrop-blur-md shadow-xl transition-all">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">手机号登录</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={loginAction} className="space-y-3.5">
              {params?.error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  {params.error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium">手机号码</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="例如: 13800000001"
                  defaultValue="13800000001"
                  required
                  maxLength={11}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium">密码</Label>
                  <span className="text-[10px] text-muted-foreground">初始密码为手机后6位</span>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="请输入登录密码"
                  defaultValue="000001"
                  required
                  className="h-9 text-xs font-mono"
                />
              </div>

              <Button type="submit" className="w-full h-9 text-xs font-semibold mt-2">
                登录系统
                <ArrowRight className="size-3.5 ml-1" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
