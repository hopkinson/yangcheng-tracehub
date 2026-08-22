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
import { Button } from "@/components/ui/button";
import { UserRoleSwitcher } from "./UserRoleSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "工作台",
    items: [
      { href: "/", label: "总览看板", icon: Building2 },
      { href: "/approvals", label: "审批中心", icon: CheckSquare },
    ],
  },
  {
    title: "生产与仓储",
    items: [
      { href: "/batches", label: "原料批次", icon: Layers },
      { href: "/pools", label: "暂养监控", icon: Waves },
      { href: "/tags", label: "蟹扣管理", icon: Tag },
      { href: "/outbound", label: "出库管理", icon: Truck },
    ],
  },
  {
    title: "档案与台账",
    items: [
      { href: "/farmers", label: "养殖档案", icon: Users },
      { href: "/stores", label: "门店档案", icon: Store },
      { href: "/ledgers", label: "合规台账", icon: BookOpen },
      { href: "/trace", label: "追溯查询", icon: FileSearch },
    ],
  },
  {
    title: "系统设置",
    items: [
      { href: "/users", label: "用户管理", icon: UserCog },
    ],
  },
];

const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  QA_DIRECTOR: ["/", "/batches", "/pools", "/stores", "/tags", "/outbound", "/approvals", "/ledgers", "/trace"],
  WAREHOUSE_ADMIN: ["/", "/batches", "/pools", "/stores", "/tags", "/outbound", "/ledgers", "/trace"],
  FARMER_ADMIN: ["/", "/farmers", "/ledgers", "/trace"],
  CHANNEL_VIEWER: ["/", "/trace"],
};

export function AppShell({
  children,
  currentUser,
  currentUserId,
  currentRole,
  pendingAlertCount = 0,
}: {
  children: React.ReactNode;
  currentUser?: { id: string; fullName: string; role: string; username?: string; channelName?: string | null } | null;
  currentUserId: string;
  currentRole: string;
  pendingAlertCount?: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname === "/login") return <>{children}</>;

  const allowedRoutes = ROLE_ALLOWED_ROUTES[currentRole];
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: allowedRoutes
      ? group.items.filter((i) => allowedRoutes.includes(i.href))
      : group.items,
  })).filter((group) => group.items.length > 0);

  const renderNavList = (isCollapsed: boolean) => (
    <nav className="flex-1 space-y-3 px-2 py-2.5 overflow-y-auto">
      {visibleGroups.map((group, groupIdx) => (
        <div key={group.title} className="space-y-0.5">
          {!isCollapsed ? (
            <div className="px-2 pt-1 pb-1 text-[11px] font-medium text-muted-foreground/75 tracking-wider">
              {group.title}
            </div>
          ) : (
            groupIdx > 0 && <div className="my-2 mx-1 border-t border-border/50" />
          )}
          <div className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              const showAlert = href === "/approvals" && pendingAlertCount > 0;

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  title={isCollapsed ? label : undefined}
                  className={cn(
                    "group relative flex items-center justify-between gap-2 rounded-lg px-2.5 h-8.5 text-xs font-medium transition-colors w-full",
                    isActive
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />
                  )}
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
                      )}
                    />
                    {!isCollapsed && <span className="truncate">{label}</span>}
                  </div>
                  {!isCollapsed && showAlert && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive/15 text-destructive ring-1 ring-destructive/30 px-1 text-[10px] font-bold">
                      {pendingAlertCount}
                    </span>
                  )}
                  {isCollapsed && showAlert && (
                    <span className="size-1.5 rounded-full bg-destructive" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* 桌面端侧边栏 */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border/80 bg-sidebar/50 dark:bg-sidebar/30 backdrop-blur-md sticky top-0 h-screen transition-all duration-200 z-30 shrink-0 select-none",
          collapsed ? "w-14" : "w-44"
        )}
      >
        {/* Logo 区域 */}
        <div
          className={cn(
            "flex h-14 items-center border-b border-border/80 px-2 transition-all",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <Link
            href="/"
            className={cn(
              "group flex items-center rounded-lg transition-colors",
              collapsed
                ? "justify-center size-9 hover:bg-muted/70"
                : "w-full px-2.5 h-9 hover:bg-muted/70"
            )}
            title={collapsed ? "阳澄品控溯源系统" : undefined}
          >
            <Logo collapsed={collapsed} size="sm" />
          </Link>
        </div>

        {/* 导航项 */}
        {renderNavList(collapsed)}

        {/* 侧栏底部折叠按钮 */}
        <div className="border-t border-border/80 p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full h-8 text-muted-foreground/80 hover:text-foreground hover:bg-muted/70 text-xs rounded-lg justify-center gap-1.5"
            title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : (
              <>
                <PanelLeftClose className="size-3.5" />
                <span>收起</span>
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
          <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border/80 bg-background shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-border/80 px-3">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="group flex items-center px-2 h-9 rounded-lg hover:bg-muted/70"
              >
                <Logo collapsed={false} size="sm" />
              </Link>
              <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={() => setMobileOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            {renderNavList(false)}
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
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <UserRoleSwitcher user={currentUser} />
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 p-3 sm:p-4 md:p-5 w-full max-w-[1600px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
