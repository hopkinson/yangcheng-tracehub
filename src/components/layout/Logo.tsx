"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  iconClassName?: string;
  collapsed?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * 阳澄湖大闸蟹溯源品控系统 - 品牌徽标图标
 */
export function CrabLogoIcon({ className }: { className?: string }) {
  return (
    <div className={cn("relative inline-flex items-center justify-center shrink-0 select-none", className)}>
      <Image
        src="/logo-emblem.png"
        alt="阳澄湖大闸蟹溯源品控系统"
        width={191}
        height={254}
        priority
        className="size-full object-contain drop-shadow-xs"
      />
    </div>
  );
}

/**
 * 阳澄股份 - 完整带文字品牌 Logo (包含图形徽标 + 阳澄股份® YANGCHENG STOCK)
 */
export function BrandFullLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative inline-flex items-center justify-center select-none", className)}>
      {/* 浅色模式显示深色文字版 */}
      <Image
        src="/logo-brand.png"
        alt="阳澄股份 YANGCHENG STOCK"
        width={996}
        height={281}
        priority={priority}
        className="w-full h-auto object-contain dark:hidden"
      />
      {/* 深色模式显示高亮文字版 */}
      <Image
        src="/logo-brand-dark.png"
        alt="阳澄股份 YANGCHENG STOCK"
        width={996}
        height={281}
        priority={priority}
        className="w-full h-auto object-contain hidden dark:block"
      />
    </div>
  );
}

const ICON_SIZES = { sm: "size-6", md: "size-7", lg: "size-9" } as const;

export function Logo({
  className,
  iconClassName,
  collapsed = false,
  size = "md",
}: LogoProps) {
  return (
    <div
      className={cn(
        "flex items-center select-none min-w-0",
        collapsed ? "justify-center" : "gap-2.5",
        className
      )}
    >
      <CrabLogoIcon
        className={cn(
          ICON_SIZES[size],
          "transition-transform duration-200 group-hover:scale-105 shrink-0",
          iconClassName
        )}
      />

      {!collapsed && (
        <span className="text-xs font-bold tracking-tight text-foreground truncate">
          阳澄湖大闸蟹溯源品控系统
        </span>
      )}
    </div>
  );
}
