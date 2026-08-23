import { LoginForm } from "./LoginForm";
import { CrabLogoIcon } from "@/components/layout/Logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const params = await searchParams;
  const sceneId =
    process.env.NEXT_PUBLIC_ALIYUN_CAPTCHA_SCENE_ID ||
    process.env.ALIYUN_CAPTCHA_SCENE_ID ||
    "";
  const prefix =
    process.env.NEXT_PUBLIC_ALIYUN_CAPTCHA_PREFIX ||
    process.env.ALIYUN_CAPTCHA_PREFIX ||
    "";

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-slate-950/2 dark:bg-background overflow-hidden selection:bg-sky-500/20">
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
        </div>

        {/* 登录表单 */}
        <LoginForm
          sceneId={sceneId}
          prefix={prefix}
          error={params?.error}
          redirectUrl={params?.redirect}
        />
      </div>
    </div>
  );
}
