import { LoginForm } from "./LoginForm";
import { BrandFullLogo } from "@/components/layout/Logo";

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
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-background overflow-hidden selection:bg-sky-500/20">
      {/* 1. 阳澄湖水系与科技栅格背景层 (优雅低调、若隐若现的微质感) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* 顶部中央湖蓝主光晕 */}
        <div className="absolute -top-[25%] left-1/2 -translate-x-1/2 w-[1000px] h-[550px] rounded-full bg-gradient-to-b from-sky-500/15 dark:from-sky-500/20 via-teal-500/10 dark:via-teal-400/15 to-transparent blur-3xl" />
        {/* 左下方深水青光晕 */}
        <div className="absolute -bottom-[15%] -left-[10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-teal-500/10 dark:from-teal-500/15 via-sky-500/10 dark:via-sky-400/12 to-transparent blur-3xl" />
        {/* 右上方金爪微金光晕 */}
        <div className="absolute top-[5%] -right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-amber-500/10 dark:from-amber-400/12 via-sky-400/8 to-transparent blur-3xl" />

        {/* 2. 科技网格 (低饱和度、中心平滑羽化) */}
        <svg
          className="absolute inset-0 w-full h-full text-slate-800/[0.05] dark:text-sky-300/[0.12]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="tech-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              {/* 微细网格线 */}
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
              />
              {/* 微小交叉点 */}
              <circle cx="0" cy="0" r="1" fill="currentColor" opacity="0.4" />
              <circle cx="48" cy="0" r="1" fill="currentColor" opacity="0.4" />
              <circle cx="0" cy="48" r="1" fill="currentColor" opacity="0.4" />
              <circle cx="48" cy="48" r="1" fill="currentColor" opacity="0.4" />
            </pattern>
            {/* 平滑径向羽化遮罩，避免边缘生硬 */}
            <radialGradient id="grid-fade" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.6" />
              <stop offset="85%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <mask id="grid-mask">
              <rect width="100%" height="100%" fill="url(#grid-fade)" />
            </mask>
          </defs>

          {/* 带羽化渐变的网格 */}
          <rect width="100%" height="100%" fill="url(#tech-grid)" mask="url(#grid-mask)" />
          
          {/* 水系流动等深线弧线 (细腻温和) */}
          <path d="M-100 200 C 300 120, 600 280, 1100 160 C 1500 60, 1800 240, 2200 180" className="stroke-sky-500/[0.12] dark:stroke-sky-400/[0.18]" strokeWidth="1.2" strokeDasharray="6 4" fill="none" />
          <path d="M-100 450 C 400 380, 700 520, 1200 420 C 1600 340, 1900 490, 2300 440" className="stroke-teal-500/[0.14] dark:stroke-teal-400/[0.20]" strokeWidth="1.4" fill="none" />
          <path d="M-100 700 C 350 620, 650 780, 1150 680 C 1550 600, 1850 760, 2250 710" className="stroke-sky-500/[0.10] dark:stroke-sky-400/[0.16]" strokeWidth="1.2" strokeDasharray="4 4" fill="none" />
          <path d="M-100 920 C 450 860, 750 980, 1250 900 C 1650 820, 1950 950, 2350 910" className="stroke-teal-500/[0.12] dark:stroke-teal-400/[0.18]" strokeWidth="1.4" fill="none" />

          {/* 围网养殖微锚点 */}
          <circle cx="20%" cy="25%" r="3.5" className="fill-sky-500/20 dark:fill-sky-400/30 stroke-sky-500/40 dark:stroke-sky-300/50" strokeWidth="1" />
          <circle cx="20%" cy="25%" r="12" className="stroke-sky-500/20 dark:stroke-sky-400/30" strokeWidth="1" strokeDasharray="2 2" fill="none" />
          
          <circle cx="80%" cy="30%" r="4" className="fill-teal-500/20 dark:fill-teal-400/30 stroke-teal-500/40 dark:stroke-teal-300/50" strokeWidth="1" />
          <circle cx="80%" cy="30%" r="14" className="stroke-teal-500/20 dark:stroke-teal-400/30" strokeWidth="1" strokeDasharray="2 2" fill="none" />
          
          <circle cx="15%" cy="75%" r="3.5" className="fill-sky-500/20 dark:fill-sky-400/30 stroke-sky-500/40 dark:stroke-sky-300/50" strokeWidth="1" />
          <circle cx="85%" cy="78%" r="3.5" className="fill-amber-500/20 dark:fill-amber-400/30 stroke-amber-500/40 dark:stroke-amber-300/50" strokeWidth="1" />
        </svg>
      </div>

      {/* 登录卡片主体 */}
      <div className="w-full max-w-sm space-y-6 relative z-10">
        {/* 顶部品牌标语与带文字大 Logo */}
        <div className="text-center space-y-3.5 flex flex-col items-center">
          <div className="relative group flex items-center justify-center w-full px-2">
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-sky-500/20 via-teal-500/20 to-amber-500/15 blur-xl opacity-75 group-hover:opacity-100 transition duration-500" />
            <div className="relative flex items-center justify-center transition-transform duration-300 group-hover:scale-[1.02] w-full max-w-[290px]">
              <BrandFullLogo priority className="w-full drop-shadow-sm" />
            </div>
          </div>

          <h1 className="text-lg font-bold tracking-tight text-foreground">
            阳澄湖大闸蟹溯源品控系统
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
