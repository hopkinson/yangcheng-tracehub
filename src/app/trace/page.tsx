import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldX, SearchX, Layers } from "lucide-react";
import Link from "next/link";
import { TraceSearchHero } from "@/components/trace/TraceSearchHero";
import { TraceEmptyState } from "@/components/trace/TraceEmptyState";
import { TraceCertificateHeader } from "@/components/trace/TraceCertificateHeader";
import { TraceTopologyFlow } from "@/components/trace/TraceTopologyFlow";
import { TraceAuditLedger } from "@/components/trace/TraceAuditLedger";

export const dynamic = "force-dynamic";

export default async function TracePage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; orderCode?: string }>;
}) {
  const [currentUser, params] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ]);

  const searchTerm = params.query?.trim() || "";
  const selectedOrderCode = params.orderCode?.trim();
  const isChannelViewer = currentUser?.role === "CHANNEL_VIEWER";

  // 1. 查询匹配的出库单 (渠道账号自动限定本渠道，避免同批次跨渠道误伤)
  const orders = searchTerm
    ? await prisma.outboundOrder.findMany({
        where: {
          OR: [
            { code: { contains: searchTerm } },
            { batch: { code: { contains: searchTerm } } },
          ],
          ...(isChannelViewer && currentUser?.channelId
            ? { channelId: currentUser.channelId }
            : {}),
        },
        include: {
          batch: {
            include: {
              farmer: { include: { enclosures: true } },
              enclosure: true,
              pool: true,
            },
          },
          store: { include: { channel: true } },
          channel: true,
          applicant: true,
          approver: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const order = orders.find((o) => o.code === selectedOrderCode) || orders[0];

  // 2. 跨渠道违规判断：仅当本渠道无匹配，但在全局能查到该单号/批次时提示拦截
  const isCrossChannelForbidden =
    isChannelViewer &&
    orders.length === 0 &&
    !!searchTerm &&
    Boolean(
      await prisma.outboundOrder.findFirst({
        where: {
          OR: [
            { code: { contains: searchTerm } },
            { batch: { code: { contains: searchTerm } } },
          ],
        },
      })
    );

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* 1. 顶部全链路溯源 Search Hero 区域 */}
      <TraceSearchHero
        initialQuery={searchTerm}
        isChannelViewer={isChannelViewer}
        channelName={currentUser?.channel?.name}
      />

      {/* 2. 状态呈现分发 */}
      {!searchTerm ? (
        /* 未检索时：高质感引导与四大验真保障空状态 */
        <TraceEmptyState />
      ) : isCrossChannelForbidden ? (
        /* 渠道隔离拦截 */
        <Card className="border-destructive/40 bg-destructive/5 shadow-xs">
          <CardContent className="py-12 flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
              <ShieldX className="size-8" />
            </div>
            <div className="flex flex-col gap-1 max-w-lg">
              <h3 className="text-base font-bold text-destructive">无权查阅其他渠道数据</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                当前为【<strong className="text-foreground">{currentUser?.channel?.name}</strong>】渠道视角，单号{" "}
                <span className="font-mono font-bold text-foreground">{searchTerm}</span>{" "}
                发往其他渠道，无权查阅。
              </p>
            </div>
          </CardContent>
        </Card>
      ) : !order ? (
        /* 未找到对应溯源记录 */
        <Card className="border-border/80 shadow-xs">
          <CardContent className="py-14 flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground border">
              <SearchX className="size-8" />
            </div>
            <div className="flex flex-col gap-1 max-w-md">
              <h3 className="text-base font-bold text-foreground">未检索到溯源档案</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                未检索到单号为 <span className="font-mono font-bold text-foreground">{searchTerm}</span> 的记录，请检查单号拼写。
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* 检索成功：展示权威溯源档案与全链路逆向流水线 */
        <div className="flex flex-col gap-6">
          {/* 多出库单切换栏 (如果一个批次有多笔出库) */}
          {orders.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs print:hidden bg-muted/40 p-2.5 rounded-xl border">
              <span className="text-muted-foreground shrink-0 font-medium flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" />
                该批次关联多笔出库 ({orders.length} 笔):
              </span>
              <div className="flex items-center gap-2">
                {orders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/trace?query=${encodeURIComponent(searchTerm)}&orderCode=${encodeURIComponent(o.code)}`}
                    className={`px-3 py-1 rounded-lg border text-xs font-mono transition-all ${
                      o.code === order.code
                        ? "bg-primary text-primary-foreground font-bold border-primary shadow-xs"
                        : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border/80"
                    }`}
                  >
                    {o.code} ({o.store.name} · {o.outboundCount}只)
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 1. 官方权威溯源验真档案证书 Header */}
          <TraceCertificateHeader order={order} />

          {/* 2. 供应链五级逆向拓扑流水线 (彻底消除菜单感) */}
          <TraceTopologyFlow order={order} />

          {/* 3. 数量守恒数学闭环证明与合规声明 */}
          <TraceAuditLedger order={order} />
        </div>
      )}
    </div>
  );
}
