"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// 容器子项入场 (轻量 CSS 样式)
export function StaggerContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("animate-in fade-in duration-300", className)}>{children}</div>;
}

// 单个区块轻微淡入
export function FadeIn({
  children,
  className,
  direction = "none",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  direction?: "up" | "down" | "none";
  delay?: number;
}) {
  const dirClass = direction === "down" ? "slide-in-from-top-2" : direction === "up" ? "slide-in-from-bottom-2" : "";
  return (
    <div
      className={cn("animate-in fade-in duration-300 fill-mode-both", dirClass, className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// 格式化数字平滑递增滚动展示 (Spring Ease Number Roll)
export function AnimatedNumber({
  value,
  className,
  duration = 600,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState<number>(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = 0;
    const targetValue = value;

    if (targetValue === 0) {
      setDisplayValue(0);
      return;
    }

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease-out cubic curve
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (targetValue - startValue) * easeOut);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(targetValue);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  return <span className={cn("tabular-nums", className)}>{displayValue.toLocaleString()}</span>;
}

// 状态微光呼吸灯
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
