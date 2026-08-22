"use client";

import { use, useState, useEffect, useRef } from "react";
import Script from "next/script";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/actions/auth";
import { ArrowRight, Phone, Lock, Eye, EyeOff, ShieldCheck, Loader2 } from "lucide-react";
import { CrabLogoIcon } from "@/components/layout/Logo";

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

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const params = use(searchParams);
  const [phone, setPhone] = useState("13800000001");
  const [password, setPassword] = useState("000001");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaVerifyParam, setCaptchaVerifyParam] = useState("");
  const [clientError, setClientError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const captchaInstanceRef = useRef<AliyunCaptchaInstance | null>(null);
  const captchaInitializedRef = useRef(false);

  const sceneId = process.env.NEXT_PUBLIC_ALIYUN_CAPTCHA_SCENE_ID;
  const prefix = process.env.NEXT_PUBLIC_ALIYUN_CAPTCHA_PREFIX;
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

  // 页面挂载时兜底初始化（防止脚本已缓存导致 onLoad 不触发）
  useEffect(() => {
    if (typeof window !== "undefined" && window.initAliyunCaptcha) {
      initCaptcha();
    }
  }, []);

  // 当登录报错重定向回来时，重置验证码状态
  useEffect(() => {
    if (params?.error) {
      setCaptchaVerifyParam("");
      setIsSubmitting(false);
      captchaInstanceRef.current?.reset();
    }
  }, [params?.error]);

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
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-slate-950/2 dark:bg-background overflow-hidden selection:bg-sky-500/20">
      {/* 异步引入阿里云验证码 2.0 官方 SDK */}
      <Script
        src="https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js"
        strategy="afterInteractive"
        onLoad={initCaptcha}
      />

      {/* 1. 阳澄湖水系与自然光晕渐变背景 */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* 顶部中央湖蓝主光晕 */}
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] rounded-full bg-gradient-to-b from-sky-400/20 via-teal-400/10 to-transparent blur-3xl" />
        {/* 左下方深水青光晕 */}
        <div className="absolute -bottom-[10%] -left-[10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-teal-500/15 via-sky-500/10 to-transparent blur-3xl" />
        {/* 右上方金爪微金光晕 */}
        <div className="absolute top-[10%] -right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-amber-400/10 via-sky-400/5 to-transparent blur-3xl" />

        {/* 2. 阳澄湖等高线/水流波纹矢量网底 */}
        <svg
          className="absolute inset-0 w-full h-full stroke-sky-800/10 dark:stroke-sky-300/5 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_80%)]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
        >
          <defs>
            <pattern id="grid-pattern" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" strokeWidth="0.75" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          
          {/* 水系流动等深线弧线 */}
          <path d="M-100 200 C 300 120, 600 280, 1100 160 C 1500 60, 1800 240, 2200 180" strokeWidth="1.2" strokeDasharray="6 4" opacity="0.6" />
          <path d="M-100 450 C 400 380, 700 520, 1200 420 C 1600 340, 1900 490, 2300 440" strokeWidth="1.5" opacity="0.7" />
          <path d="M-100 700 C 350 620, 650 780, 1150 680 C 1550 600, 1850 760, 2250 710" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
          <path d="M-100 920 C 450 860, 750 980, 1250 900 C 1650 820, 1950 950, 2350 910" strokeWidth="1.5" opacity="0.6" />

          {/* 围网养殖与水域微锚点 */}
          <circle cx="22%" cy="28%" r="4" className="fill-sky-500/20 stroke-sky-500/40" strokeWidth="1" />
          <circle cx="22%" cy="28%" r="12" className="stroke-sky-500/20" strokeWidth="1" strokeDasharray="2 2" />
          <circle cx="78%" cy="32%" r="5" className="fill-teal-500/20 stroke-teal-500/40" strokeWidth="1" />
          <circle cx="78%" cy="32%" r="15" className="stroke-teal-500/20" strokeWidth="1" strokeDasharray="2 2" />
          <circle cx="18%" cy="72%" r="4.5" className="fill-sky-500/20 stroke-sky-500/40" strokeWidth="1" />
          <circle cx="82%" cy="75%" r="4" className="fill-amber-500/20 stroke-amber-500/40" strokeWidth="1" />
        </svg>
      </div>

      {/* 登录卡片主体 */}
      <div className="w-full max-w-sm space-y-5 relative z-10">
        {/* 顶部品牌标语 */}
        <div className="text-center space-y-2.5 flex flex-col items-center">
          <div className="relative group">
            <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-sky-500/30 to-teal-500/30 blur-md opacity-80 group-hover:opacity-100 transition duration-300" />
            <CrabLogoIcon className="relative size-14 shadow-lg ring-1 ring-white/60 dark:ring-white/10 rounded-2xl" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-foreground">
            阳澄大闸蟹溯源品控系统
          </h1>
          {isCaptchaConfigured && (
            <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 bg-muted/40 px-2 py-0.5 rounded-full border border-border/50">
              <ShieldCheck className="size-3 text-sky-500" />
              <span>已启用阿里云智能风控防御</span>
            </div>
          )}
        </div>

        {/* 登录表单卡片 */}
        <Card className="border-border/80 bg-card/90 dark:bg-card/80 backdrop-blur-xl shadow-xl shadow-sky-950/5">
          <CardContent className="pt-6 pb-6">
            <form action={loginAction} onSubmit={handleSubmit} className="space-y-4">
              {params?.redirect && (
                <input type="hidden" name="redirect" value={params.redirect} />
              )}
              {/* 隐藏的验证码凭证域 */}
              <input
                type="hidden"
                name="captchaVerifyParam"
                value={captchaVerifyParam}
              />

              {(clientError || params?.error) && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
                  {clientError || params?.error}
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
                <div id="captcha-element" className="w-full flex justify-center py-0.5" />
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
      </div>
    </div>
  );
}
