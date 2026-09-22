import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { getCurrentUser } from "@/lib/auth";

import { prisma } from "@/lib/prisma";

import { getTenant } from "@/config/tenant";
import { canApprove } from "@/config/approval";
import { getApprovalSetting } from "@/lib/approval-settings";

export function generateMetadata(): Metadata {
  const tenant = getTenant();
  return {
    title: tenant.name,
    description: "阳澄湖大闸蟹数量闭环管控与品质合规证明系统",
    icons: {
      icon: [
        { url: tenant.favicon, sizes: "any" },
        { url: tenant.icon, sizes: "192x192", type: "image/png" },
      ],
      shortcut: tenant.favicon,
      apple: [
        { url: tenant.icon, sizes: "180x180", type: "image/png" },
      ],
    },
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = getTenant();
  const [currentUser, approvalSetting] = await Promise.all([
    getCurrentUser(),
    getApprovalSetting(),
  ]);

  const canApproveTagClaims = canApprove(currentUser?.role, approvalSetting.tagClaimRole);
  const canApproveOutbound = canApprove(currentUser?.role, approvalSetting.outboundRole);
  const canAccessApprovals = canApproveTagClaims || canApproveOutbound;

  let pendingAlertCount = 0;
  if (currentUser && (canApproveTagClaims || canApproveOutbound)) {
    const [tagCount, outboundCount] = await Promise.all([
      canApproveTagClaims ? prisma.tagClaim.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
      canApproveOutbound ? prisma.outboundOrder.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    ]);
    pendingAlertCount = tagCount + outboundCount;
  }

  return (
    <html lang="zh-CN" data-tenant={tenant.id} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppShell
            currentUser={
              currentUser
                ? {
                    id: currentUser.id,
                    fullName: currentUser.fullName,
                    role: currentUser.role,
                    username: currentUser.username,
                    channelName: currentUser.channel?.name,
                  }
                : null
            }
            currentUserId={currentUser?.id || ""}
            currentRole={currentUser?.role || ""}
            pendingAlertCount={pendingAlertCount}
            canAccessApprovals={canAccessApprovals}
          >
            {children}
          </AppShell>
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
