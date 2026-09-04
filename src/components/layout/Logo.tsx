"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getTenant } from "@/config/tenant";

export interface LogoProps {
  className?: string;
  iconClassName?: string;
  collapsed?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * 品牌徽标图标
 */
export function CrabLogoIcon({ className }: { className?: string }) {
  const tenant = getTenant();
  const isMaoshi = tenant.id === "maoshi";
  return (
    <div className={cn("relative inline-flex items-center justify-center shrink-0 select-none", className)}>
      <Image
        src={tenant.emblem}
        alt={tenant.name}
        width={isMaoshi ? 800 : 191}
        height={isMaoshi ? 800 : 254}
        priority
        className="size-full object-contain drop-shadow-xs"
      />
    </div>
  );
}

/**
 * 完整带文字品牌 Logo
 */
export function BrandFullLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  const tenant = getTenant();
  const isSquareLogo = tenant.id === "maoshi";
  const logoWidth = isSquareLogo ? 961 : 996;
  const logoHeight = isSquareLogo ? 903 : 281;

  return (
    <div className={cn("relative inline-flex items-center justify-center select-none", className)}>
      {/* 浅色模式显示深色文字版 */}
      <Image
        src={tenant.logo}
        alt={tenant.name}
        width={logoWidth}
        height={logoHeight}
        priority={priority}
        className="w-full h-auto object-contain dark:hidden"
      />
      {/* 深色模式显示高亮文字版 */}
      <Image
        src={tenant.logoDark}
        alt={tenant.name}
        width={logoWidth}
        height={logoHeight}
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
  const tenant = getTenant();
  const isMaoshi = tenant.id === "maoshi";
  return (
    <div
      className={cn(
        "flex items-center select-none min-w-0",
        collapsed ? "justify-center" : "gap-2.5",
        className
      )}
    >
      <div
        className={cn(
          "rounded-md overflow-hidden shrink-0 flex items-center justify-center",
          isMaoshi ? "bg-white p-0.5 shadow-xs" : ""
        )}
      >
        <CrabLogoIcon
          className={cn(
            ICON_SIZES[size],
            "transition-transform duration-200 group-hover:scale-105 shrink-0",
            iconClassName
          )}
        />
      </div>

      {!collapsed && (
        <span
          className={cn(
            "text-xs font-bold tracking-tight truncate",
            isMaoshi ? "text-white" : "text-foreground"
          )}
        >
          {tenant.name}
        </span>
      )}
    </div>
  );
}

