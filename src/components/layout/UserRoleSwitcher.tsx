"use client";

import { Badge } from "@/components/ui/badge";
import { logoutAction } from "@/actions/auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChangePasswordDialog } from "@/components/forms/ChangePasswordDialog";
import { KeyRound, LogOut, Shield } from "lucide-react";

export interface CurrentUser {
  id: string;
  fullName: string;
  role: string;
  username?: string;
  channelName?: string | null;
}

const ROLE_MAP: Record<string, string> = {
  ADMIN: "超级管理员",
  QA_DIRECTOR: "质检主管",
  WAREHOUSE_ADMIN: "库管员",
  FARMER_ADMIN: "内部核验员",
  CHANNEL_VIEWER: "渠道审计员",
};

export function UserRoleSwitcher({
  user,
}: {
  user?: CurrentUser | null;
}) {
  if (!user) return null;

  const firstChar = (user.fullName || user.username || "用")[0];
  const roleName = ROLE_MAP[user.role] || user.role;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full py-1 px-2.5 hover:bg-muted/70 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring border border-border/50 bg-background/50"
        >
          <div className="flex size-6.5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold select-none ring-1 ring-primary/20">
            {firstChar}
          </div>
          <span className="text-xs font-medium text-foreground max-w-[90px] truncate hidden sm:inline">
            {user.fullName || user.username}
          </span>
          <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-medium bg-primary/10 text-primary border-primary/25">
            {roleName}
          </Badge>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-52 p-2 text-xs">
        {/* 用户基本信息 */}
        <div className="flex items-center gap-2.5 p-2 rounded-md bg-muted/40 mb-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {firstChar}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-semibold text-foreground truncate text-xs">
              {user.fullName}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate mt-0.5">
              <Shield className="size-3 shrink-0 text-primary/70" />
              <span className="truncate">
                {roleName}
                {user.channelName ? ` · ${user.channelName}` : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="my-1 h-px bg-border/60" />

        {/* 修改密码 */}
        <ChangePasswordDialog
          userId={user.id}
          trigger={
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <KeyRound className="size-3.5 text-muted-foreground" />
              <span>修改密码</span>
            </button>
          }
        />

        {/* 退出登录 */}
        <form action={logoutAction} className="w-full">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <LogOut className="size-3.5" />
            <span>退出登录</span>
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
