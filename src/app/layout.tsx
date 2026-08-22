import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { getCurrentUser } from "@/lib/auth";

import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "阳澄股份大闸蟹全链路溯源品控系统",
  description: "数量闭环管控与山姆渠道合规证明系统",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.svg",
  },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    <html lang="zh-CN" suppressHydrationWarning>
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
