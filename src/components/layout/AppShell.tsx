"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Layers,
  Waves,
  Tag,
  Truck,
  CheckSquare,
  BookOpen,
  FileSearch,
  Building2,
  Store,
  UserCog,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserRoleSwitcher } from "./UserRoleSwitcher";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { href: "/", label: "总览看板", icon: Building2 },
  { href: "/farmers", label: "养殖户主档", icon: Users },
  { href: "/batches", label: "原料批次", icon: Layers },
  { href: "/pools", label: "暂养池监控", icon: Waves },
  { href: "/stores", label: "门店档案", icon: Store },
  { href: "/tags", label: "蟹扣核销", icon: Tag },
  { href: "/outbound", label: "出库管理", icon: Truck },
  { href: "/approvals", label: "审批中心", icon: CheckSquare },
  { href: "/ledgers", label: "四大台账", icon: BookOpen },
  { href: "/trace", label: "全链路追溯", icon: FileSearch },
  { href: "/users", label: "用户管理", icon: UserCog },
];

const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  QA_DIRECTOR: ["/", "/batches", "/pools", "/stores", "/tags", "/outbound", "/approvals", "/ledgers", "/trace"],
  WAREHOUSE_ADMIN: ["/", "/batches", "/pools", "/stores", "/tags", "/outbound", "/ledgers", "/trace"],
  FARMER_ADMIN: ["/", "/farmers", "/ledgers", "/trace"],
  CHANNEL_VIEWER: ["/", "/ledgers", "/trace"],
};

export function AppShell({
  children,
  users,
  currentUserId,
  currentRole,
}: {
  children: React.ReactNode;
  users: Array<{ id: string; fullName: string; role: string; channelName?: string | null }>;
  currentUserId: string;
  currentRole: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 登录页直接渲染
  if (pathname === "/login") {
    return <>{children}</>;
  }

  const allowedRoutes = ROLE_ALLOWED_ROUTES[currentRole];
  const visibleNavItems = allowedRoutes
    ? NAV_ITEMS.filter((i) => allowedRoutes.includes(i.href))
    : NAV_ITEMS;

  const navContent = (
    <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
              collapsed ? "justify-center px-2" : "",
              isActive
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* 桌面端侧边栏 */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border/80 bg-background/95 sticky top-0 h-screen transition-all duration-200 z-30 shrink-0",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo 区域 */}
        <div className={cn("flex h-14 items-center border-b border-border/80 px-4", collapsed ? "justify-center" : "justify-between")}>
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background text-xs font-black shadow-xs">
              YC
            </div>
            {!collapsed && (
              <span className="text-sm font-semibold text-foreground truncate">
                阳澄品控溯源
              </span>
            )}
          </Link>
          {!collapsed && (
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-muted-foreground border-border/60">
              v1.3
            </Badge>
          )}
        </div>

        {/* 导航项 */}
        {navContent}

        {/* 侧栏底部折叠按钮 */}
        <div className="border-t border-border/80 p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn("w-full text-muted-foreground hover:text-foreground", collapsed ? "px-0 justify-center" : "justify-start gap-2")}
            title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : (
              <>
                <PanelLeftClose className="size-4" />
                <span className="text-xs">收起导航</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* 移动端侧边栏抽屉与遮罩 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border/80 bg-background shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-border/80 px-4">
              <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 font-bold tracking-tight">
                <div className="flex size-7 items-center justify-center rounded-md bg-foreground text-background text-xs font-black">
                  YC
                </div>
                <span className="text-sm font-semibold text-foreground">阳澄品控溯源</span>
              </Link>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setMobileOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            {navContent}
          </aside>
        </div>
      )}

      {/* 右侧主体区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部 Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/80 bg-background/80 px-4 sm:px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {/* 移动端汉堡按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 md:hidden text-muted-foreground"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
              阳澄股份大闸蟹全链路溯源品控系统
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <UserRoleSwitcher users={users} currentUserId={currentUserId} />
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
