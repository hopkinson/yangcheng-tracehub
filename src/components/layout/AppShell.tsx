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
  ShoppingBag,
  Scale,
  ThermometerSnowflake,
  PackageCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserRoleSwitcher } from "./UserRoleSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
import { getTenant } from "@/config/tenant";

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
      { href: "/trace", label: "追溯查询", icon: FileSearch },
    ],
  },
  {
    title: "订单",
    items: [
      { href: "/orders", label: "订单管理", icon: ShoppingBag },
    ],
  },
  {
    title: "生产与仓储",
    items: [
      { href: "/batches", label: "原料批次", icon: Layers },
      { href: "/pools", label: "暂养监控", icon: Waves },
      { href: "/bundling", label: "捆扎管理", icon: PackageCheck },
      { href: "/sorting", label: "分拣称重", icon: Scale },
      { href: "/cold-storage", label: "保鲜预冷", icon: ThermometerSnowflake },
      { href: "/outbound", label: "出库管理", icon: Truck },
    ],
  },
  {
    title: "档案与台账",
    items: [
      { href: "/farmers", label: "养殖档案", icon: Users },
      { href: "/tags", label: "蟹扣管理", icon: Tag },
      { href: "/stores", label: "门店档案", icon: Store },
      { href: "/ledgers", label: "合规台账", icon: BookOpen },
      { href: "/users", label: "角色与权限", icon: UserCog },
    ],
  },
];

const PROD_ROUTES = ["/", "/orders", "/batches", "/pools", "/bundling", "/sorting", "/cold-storage", "/stores", "/tags", "/outbound", "/ledgers", "/trace"];
const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  QA_DIRECTOR: [...PROD_ROUTES, "/approvals"],
  WAREHOUSE_ADMIN: PROD_ROUTES,
  FARMER_ADMIN: ["/", "/farmers", "/tags", "/ledgers", "/trace", "/approvals"],
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
  const tenant = getTenant();
  const isMaoshi = tenant.id === "maoshi";

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
            <div
              className={cn(
                "px-2 pt-1 pb-1 text-[11px] font-medium tracking-wider",
                isMaoshi ? "text-white/60 font-semibold" : "text-muted-foreground/75"
              )}
            >
              {group.title}
            </div>
          ) : (
            groupIdx > 0 && (
              <div
                className={cn(
                  "my-2 mx-1 border-t",
                  isMaoshi ? "border-white/10" : "border-border/50"
                )}
              />
            )
          )}
          <div className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              const showAlert = href === "/approvals" && pendingAlertCount > 0;
              const alertText = pendingAlertCount > 99 ? "99+" : pendingAlertCount;

              const icon = (
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isMaoshi
                      ? isActive
                        ? "text-[#003c96]"
                        : "text-white/80 group-hover:text-white"
                      : isActive
                        ? "text-primary"
                        : "text-muted-foreground/70 group-hover:text-foreground"
                  )}
                />
              );

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  title={isCollapsed ? (showAlert ? `${label} (${alertText}条待办)` : label) : undefined}
                  className={cn(
                    "group relative flex items-center rounded-lg text-xs font-medium transition-colors w-full h-8.5 select-none",
                    isCollapsed ? "justify-center px-0" : "justify-between px-2.5 gap-2",
                    isMaoshi
                      ? isActive
                        ? "bg-[#eff5fe] text-[#003c96] font-bold shadow-xs"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                      : isActive
                        ? "bg-primary/15 text-primary font-semibold shadow-2xs"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  {/* 展开态激活竖条（折叠态不显示，保持圆角按钮匀称完整，避免出现左侧缺角） */}
                  {isActive && !isCollapsed && (
                    <span
                      className={cn(
                        "absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r",
                        isMaoshi ? "bg-[#003c96]" : "bg-primary"
                      )}
                    />
                  )}

                  {isCollapsed ? (
                    /* 折叠态：居中图标 + 右上角微型数字角标 */
                    <div className="relative flex items-center justify-center">
                      {icon}
                      {showAlert && (
                        <span
                          className={cn(
                            "absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold shrink-0 shadow-xs leading-none",
                            isMaoshi
                              ? isActive
                                ? "bg-red-500 text-white ring-2 ring-[#eff5fe]"
                                : "bg-red-500 text-white ring-2 ring-[#003c96]"
                              : isActive
                                ? "bg-destructive text-white ring-2 ring-primary/15"
                                : "bg-destructive text-white ring-2 ring-background"
                          )}
                        >
                          {alertText}
                        </span>
                      )}
                    </div>
                  ) : (
                    /* 展开态：图标 + 标题 + 右侧数字徽标 */
                    <>
                      <div className="flex items-center gap-2.5 truncate min-w-0">
                        {icon}
                        <span className="truncate">{label}</span>
                      </div>
                      {showAlert && (
                        <span
                          className={cn(
                            "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold shrink-0 leading-none",
                            isMaoshi
                              ? "bg-red-500 text-white ring-1 ring-red-300"
                              : "bg-destructive/15 text-destructive ring-1 ring-destructive/30"
                          )}
                        >
                          {alertText}
                        </span>
                      )}
                    </>
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
          "hidden md:flex flex-col sticky top-0 h-screen transition-all duration-200 z-30 shrink-0 select-none",
          isMaoshi
            ? "bg-[#003c96] text-white border-r border-[#002d73] shadow-md"
            : "border-r border-border/80 bg-background text-foreground backdrop-blur-md",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo 区域 */}
        <div
          className={cn(
            "flex h-14 items-center px-2 transition-all",
            isMaoshi ? "border-b border-[#002d73] bg-[#003c96]" : "border-b border-border/80",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <Link
            href="/"
            className={cn(
              "group flex items-center rounded-lg transition-colors",
              isMaoshi ? "hover:bg-white/10" : "hover:bg-muted/70",
              collapsed ? "justify-center size-9" : "w-full px-2.5 h-9"
            )}
            title={collapsed ? tenant.name : undefined}
          >
            <Logo collapsed={collapsed} size="sm" />
          </Link>
        </div>

        {/* 导航项 */}
        {renderNavList(collapsed)}

        {/* 侧栏底部折叠按钮 */}
        <div className={cn("p-2", isMaoshi ? "border-t border-[#002d73]" : "border-t border-border/80")}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full h-8 text-xs rounded-lg justify-center gap-1.5",
              isMaoshi
                ? "text-white/70 hover:text-white hover:bg-white/10"
                : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/70"
            )}
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
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
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex w-60 flex-col shadow-xl",
              isMaoshi
                ? "bg-[#003c96] text-white border-r border-[#002d73]"
                : "border-r border-border/80 bg-background"
            )}
          >
            <div
              className={cn(
                "flex h-14 items-center justify-between px-3",
                isMaoshi ? "border-b border-[#002d73]" : "border-b border-border/80"
              )}
            >
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex items-center px-2 h-9 rounded-lg",
                  isMaoshi ? "hover:bg-white/10" : "hover:bg-muted/70"
                )}
              >
                <Logo collapsed={false} size="sm" />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-8 rounded-lg", isMaoshi ? "text-white/80 hover:text-white hover:bg-white/10" : "")}
                onClick={() => setMobileOpen(false)}
              >
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
