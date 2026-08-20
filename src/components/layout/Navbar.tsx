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
];

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

  // 如果是渠道审计人员 (CHANNEL_VIEWER)，仅展示看板、四大台账与全链路追溯
  const visibleNavItems =
    currentRole === "CHANNEL_VIEWER"
      ? NAV_ITEMS.filter((item) => ["/", "/ledgers", "/trace"].includes(item.href))
      : NAV_ITEMS;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-black shadow-sm">
              阳澄
            </div>
            <span className="hidden sm:inline">大闸蟹全链路溯源品控系统</span>
          </Link>
          <Badge variant="outline" className="hidden lg:inline-flex text-xs">
            V1.3
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
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors hover:bg-muted whitespace-nowrap",
                  isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground"
                )}
              >
                <Icon className="size-3.5" data-icon="inline-start" />
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
