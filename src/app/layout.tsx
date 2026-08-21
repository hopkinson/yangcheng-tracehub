import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Toaster } from "@/components/ui/sonner";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "阳澄股份大闸蟹全链路溯源品控系统",
  description: "数量闭环管控与山姆渠道合规证明系统",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [users, currentUser] = await Promise.all([
    prisma.user.findMany({
      include: { channel: true },
      orderBy: { role: "asc" },
    }),
    getCurrentUser(),
  ]);

  const userOptions = users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    role: u.role,
    channelName: u.channel?.name,
  }));

  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Navbar
          users={userOptions}
          currentUserId={currentUser?.id || ""}
          currentRole={currentUser?.role || ""}
        />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">{children}</main>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
