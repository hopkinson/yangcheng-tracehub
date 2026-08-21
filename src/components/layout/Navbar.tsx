"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRoleSwitcher } from "./UserRoleSwitcher";

const NAV_ITEMS = [
  { href: "/", label: "总览看板", icon: Building2 },
  { href: "/farmers", label: "养殖户主档", icon: Users },
  { href: "/batches", label: "原料批次", icon: Layers },
  { href: "/pools", label: "暂养池监控", icon: Waves },
  { href: "/tags", label: "蟹扣核销", icon: Tag },
  { href: "/outbound", label: "出库管理", icon: Truck },
  { href: "/approvals", label: "审批中心", icon: CheckSquare },
  { href: "/ledgers", label: "四大台账", icon: BookOpen },
  { href: "/trace", label: "全链路追溯", icon: FileSearch },
  { href: "/users", label: "用户管理", icon: UserCog },
];

const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  QA_DIRECTOR: ["/", "/batches", "/pools", "/tags", "/outbound", "/approvals", "/ledgers", "/trace"],
  WAREHOUSE_ADMIN: ["/", "/batches", "/pools", "/tags", "/outbound", "/ledgers", "/trace"],
  FARMER_ADMIN: ["/", "/farmers", "/ledgers", "/trace"],
  CHANNEL_VIEWER: ["/", "/ledgers", "/trace"],
};

export function Navbar({
  users,
  currentUserId,
  currentRole,
}: {
  users: Array<{ id: string; fullName: string; role: string; channelName?: string | null }>;
  currentUserId: string;
  currentRole: string;
}) {
  const pathname = usePathname();

  // 登录页不渲染导航栏
  if (pathname === "/login") {
    return null;
  }

  const allowedRoutes = ROLE_ALLOWED_ROUTES[currentRole];
  const visibleNavItems = allowedRoutes ? NAV_ITEMS.filter((i) => allowedRoutes.includes(i.href)) : NAV_ITEMS;

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl transition-all">
      <div className="flex h-14 items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight group">
            <div className="flex size-7 items-center justify-center rounded-md bg-foreground text-background text-xs font-black shadow-xs tracking-tighter group-hover:opacity-90 transition-opacity">
              YC
            </div>
            <span className="hidden sm:inline text-sm font-semibold text-foreground">
              阳澄品控溯源
            </span>
          </Link>
          <Badge variant="outline" className="hidden lg:inline-flex text-[10px] font-mono px-1.5 py-0 text-muted-foreground border-border/60">
            v1.3
          </Badge>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto py-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                  isActive
                    ? "bg-secondary text-foreground font-semibold shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className={cn("size-3.5", isActive ? "text-primary" : "text-muted-foreground")} data-icon="inline-start" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <UserRoleSwitcher users={users} currentUserId={currentUserId} />
        </div>
      </div>
    </header>
  );
}
