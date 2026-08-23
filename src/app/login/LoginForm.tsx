"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/actions/auth";
import { ArrowRight, Phone, Lock, Eye, EyeOff, ShieldCheck, Loader2 } from "lucide-react";

interface AliyunCaptchaInstance {
  verify: () => void;
  reset: () => void;
}

declare global {
  interface Window {
    initAliyunCaptcha?: (config: {
      SceneId: string;
      prefix?: string;
      mode?: "popup" | "embed";
      element?: string | HTMLElement;
      button?: string | HTMLElement;
      captchaVerifyCallback?: (captchaVerifyParam: string) => Promise<any> | any;
      onBizResultCallback?: (bizResult: boolean) => void;
      getInstance?: (instance: AliyunCaptchaInstance) => void;
      immediate?: boolean;
    }) => void;
  }
}

interface LoginFormProps {
  sceneId?: string;
  prefix?: string;
  error?: string;
  redirectUrl?: string;
}

export function LoginForm({ sceneId, prefix, error, redirectUrl }: LoginFormProps) {
  const [phone, setPhone] = useState("13800000001");
  const [password, setPassword] = useState("000001");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaVerifyParam, setCaptchaVerifyParam] = useState("");
  const [clientError, setClientError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const captchaInstanceRef = useRef<AliyunCaptchaInstance | null>(null);
  const captchaInitializedRef = useRef(false);

  const isCaptchaConfigured = Boolean(sceneId);

  // 初始化阿里云验证码 2.0
  const initCaptcha = () => {
    if (
      typeof window === "undefined" ||
      !window.initAliyunCaptcha ||
      !sceneId ||
      captchaInitializedRef.current
    ) {
      return;
    }

    try {
      window.initAliyunCaptcha({
        SceneId: sceneId,
        prefix: prefix || undefined,
        mode: "embed",
        element: "#captcha-element",
        button: "#captcha-trigger-btn",
        captchaVerifyCallback: async (param: string) => {
          setCaptchaVerifyParam(param);
          setClientError("");
          return {
            captchaResult: true,
            bizResult: true,
          };
        },
        onBizResultCallback: () => {},
        getInstance: (instance: AliyunCaptchaInstance) => {
          captchaInstanceRef.current = instance;
          captchaInitializedRef.current = true;
        },
        immediate: true,
      });
    } catch (e) {
      console.warn("[Aliyun Captcha] Init failed, fallback to normal login", e);
    }
  };

  // 页面挂载或脚本就绪时初始化
  useEffect(() => {
    if (typeof window !== "undefined" && window.initAliyunCaptcha) {
      initCaptcha();
    }
  }, [sceneId]);

  // 当服务端报错返回时，重置验证码状态
  useEffect(() => {
    if (error) {
      setCaptchaVerifyParam("");
      setIsSubmitting(false);
      captchaInstanceRef.current?.reset();
    }
  }, [error]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (isCaptchaConfigured && !captchaVerifyParam) {
      e.preventDefault();
      setClientError("请先完成下方滑块验证");
      return;
    }
    setClientError("");
    setIsSubmitting(true);
  };

  return (
    <>
      {/* 异步引入阿里云验证码 2.0 官方 SDK */}
      <Script
        src="https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js"
        strategy="afterInteractive"
        onLoad={initCaptcha}
      />

      {isCaptchaConfigured && (
        <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 bg-muted/40 px-2 py-0.5 rounded-full border border-border/50 mb-2">
          <ShieldCheck className="size-3 text-sky-500" />
          <span>已启用阿里云智能风控防御</span>
        </div>
      )}

      {/* 登录表单卡片 */}
      <Card className="border-border/80 bg-card/90 dark:bg-card/80 backdrop-blur-xl shadow-xl shadow-sky-950/5">
        <CardContent className="pt-6 pb-6">
          <form action={loginAction} onSubmit={handleSubmit} className="space-y-4">
            {redirectUrl && (
              <input type="hidden" name="redirect" value={redirectUrl} />
            )}
            {/* 隐藏的验证码凭证域 */}
            <input
              type="hidden"
              name="captchaVerifyParam"
              value={captchaVerifyParam}
            />

            {(clientError || error) && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
                {clientError || error}
              </div>
            )}

            {/* 手机号输入 */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-medium text-foreground/90">
                手机号码
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  maxLength={11}
                  className="h-9 pl-9 text-xs font-mono tracking-wide bg-background/50"
                />
              </div>
            </div>

            {/* 密码输入 */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-foreground/90">
                登录密码
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-9 pl-9 pr-9 text-xs font-mono bg-background/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                  title={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* 嵌入式验证码容器 */}
            {isCaptchaConfigured && (
              <div id="captcha-element" className="w-full flex justify-center py-0.5 min-h-[40px]" />
            )}

            {/* 登录按钮 */}
            <Button
              id="captcha-trigger-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full h-9 text-xs font-medium mt-2 gap-1.5 shadow-sm hover:shadow transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>正在登录...</span>
                </>
              ) : (
                <>
                  <span>登录系统</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
