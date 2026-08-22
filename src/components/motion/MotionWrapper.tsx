import { cn } from "@/lib/utils";

// 容器子项入场 (轻量 CSS 样式)
export function StaggerContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return <div className={cn("animate-in fade-in duration-300", className)}>{children}</div>;
}

// 单个区块轻微淡入
export function FadeIn({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  direction?: "up" | "down" | "none";
}) {
  return (
    <div className={cn("animate-in fade-in slide-in-from-bottom-2 duration-300", className)}>
      {children}
    </div>
  );
}

// 格式化数字展示
export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return <span className={className}>{value.toLocaleString()}</span>;
}

// 状态微光呼吸灯 (Tailwind 原生 CSS 动画)
export function PulseBadge({
  children,
  className,
  color = "emerald",
}: {
  children: React.ReactNode;
  className?: string;
  color?: "emerald" | "amber" | "rose" | "blue";
}) {
  const bg = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    blue: "bg-blue-500",
  }[color];

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative flex size-2">
        <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", bg)} />
        <span className={cn("relative inline-flex size-2 rounded-full", bg)} />
      </span>
      {children}
    </span>
  );
}

