import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { getCurrentUser } from "@/lib/auth";

import { prisma } from "@/lib/prisma";

import { getTenant } from "@/config/tenant";

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
  const currentUser = await getCurrentUser();

  let pendingAlertCount = 0;
  if (currentUser && (currentUser.role === "QA_DIRECTOR" || currentUser.role === "ADMIN")) {
    const counts = await prisma.$transaction([
      prisma.tagClaim.count({ where: { status: "PENDING" } }),
      prisma.outboundOrder.count({ where: { status: "PENDING" } }),
      prisma.batch.count({ where: { isException: true, status: { not: "COMPLETED" } } }),
    ]);
    pendingAlertCount = counts.reduce((a, b) => a + b, 0);
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
          >
            {children}
          </AppShell>
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
