"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  iconClassName?: string;
  collapsed?: boolean;
  size?: "sm" | "md";
}

/**
 * 阳澄大闸蟹溯源品控系统 - 品牌矢量徽章图标 (SVG)
 * 蕴含阳澄湖水青质感、大闸蟹金爪轮廓与全链路溯源品质认证盾牌
 */
export function CrabLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="yc-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="50%" stopColor="#0369a1" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id="yc-crab-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f0f9ff" />
        </linearGradient>
        <linearGradient id="yc-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <filter id="yc-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* 外层圆角质感盾板 */}
      <rect width="64" height="64" rx="14" fill="url(#yc-bg-grad)" />
      <rect
        x="0.75"
        y="0.75"
        width="62.5"
        height="62.5"
        rx="13.25"
        stroke="#38bdf8"
        strokeWidth="1.5"
        strokeOpacity="0.4"
      />

      {/* 阳澄湖水波纹光影 */}
      <path
        d="M12 49 C20 47, 24 51, 32 49 C40 47, 44 51, 52 49"
        stroke="#38bdf8"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeOpacity="0.4"
        fill="none"
      />
      <path
        d="M16 53 C22 51.5, 26 54.5, 32 53 C38 51.5, 42 54.5, 48 53"
        stroke="#38bdf8"
        strokeWidth="1"
        strokeLinecap="round"
        strokeOpacity="0.25"
        fill="none"
      />

      {/* 大闸蟹与溯源核心主体 */}
      <g filter="url(#yc-shadow)">
        {/* 左侧三对步足 */}
        <path
          d="M20 31 C14 31, 10 33, 8 36"
          stroke="url(#yc-crab-grad)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M19 35 C13 36, 10 39, 9 43"
          stroke="url(#yc-crab-grad)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M20 39 C15 41, 13 45, 12 48"
          stroke="url(#yc-crab-grad)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* 右侧三对步足 */}
        <path
          d="M44 31 C50 31, 54 33, 56 36"
          stroke="url(#yc-crab-grad)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M45 35 C51 36, 54 39, 55 43"
          stroke="url(#yc-crab-grad)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M44 39 C49 41, 51 45, 52 48"
          stroke="url(#yc-crab-grad)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* 左鳌（金爪大钳） */}
        <path
          d="M23 27 C17 25, 14 19, 15 14"
          stroke="url(#yc-crab-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M15 14 C13 9, 18 7, 21 11 C22 13, 20 16, 15 14 Z"
          fill="url(#yc-gold-grad)"
        />
        <path
          d="M15 14 C17 11, 22 13, 23 16 C21 18, 17 17, 15 14 Z"
          fill="url(#yc-crab-grad)"
        />

        {/* 右鳌（金爪大钳） */}
        <path
          d="M41 27 C47 25, 50 19, 49 14"
          stroke="url(#yc-crab-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M49 14 C51 9, 46 7, 43 11 C42 13, 44 16, 49 14 Z"
          fill="url(#yc-gold-grad)"
        />
        <path
          d="M49 14 C47 11, 42 13, 41 16 C43 18, 47 17, 49 14 Z"
          fill="url(#yc-crab-grad)"
        />

        {/* 蟹甲主壳（青背白肚） */}
        <path
          d="M32 20 C23 20, 18 25, 19 34 C20 41, 26 44, 32 44 C38 44, 44 41, 45 34 C46 25, 41 20, 32 20 Z"
          fill="url(#yc-crab-grad)"
        />

        {/* 蟹眼 */}
        <circle cx="28.5" cy="20" r="1.5" fill="url(#yc-gold-grad)" />
        <circle cx="35.5" cy="20" r="1.5" fill="url(#yc-gold-grad)" />

        {/* 品控与溯源刻纹 */}
        <path
          d="M32 24 L32 38"
          stroke="#0284c7"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M26 28 C28 32, 36 32, 38 28"
          stroke="#0284c7"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M27 34 C29 37, 35 37, 37 34"
          stroke="#0284c7"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* 中心金质品质认证锚点 */}
        <circle cx="32" cy="31" r="2" fill="url(#yc-gold-grad)" />
      </g>
    </svg>
  );
}

export function Logo({
  className,
  iconClassName,
  collapsed = false,
  size = "md",
}: LogoProps) {
  const iconSize = size === "sm" ? "size-6" : "size-6.5";

  return (
    <div
      className={cn(
        "flex items-center select-none",
        collapsed ? "justify-center" : "gap-2.5",
        className
      )}
    >
      <CrabLogoIcon
        className={cn(
          iconSize,
          "shadow-xs transition-transform duration-200 group-hover:scale-105",
          iconClassName
        )}
      />

      {!collapsed && (
        <span className="text-xs font-bold tracking-tight text-foreground truncate">
          阳澄股份
        </span>
      )}
    </div>
  );
}
