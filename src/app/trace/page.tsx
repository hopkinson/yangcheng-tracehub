import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { SearchX } from "lucide-react";
import { TraceSearchHero } from "@/components/trace/TraceSearchHero";
import { TraceEmptyState } from "@/components/trace/TraceEmptyState";
import { TraceCertificateHeader } from "@/components/trace/TraceCertificateHeader";
import { TraceTopologyFlow } from "@/components/trace/TraceTopologyFlow";
import { TraceAuditLedger } from "@/components/trace/TraceAuditLedger";
import { resolveTraceQuery } from "@/lib/trace-service";

export const dynamic = "force-dynamic";

export default async function TracePage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const [currentUser, params] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ]);

  const searchTerm = params.query?.trim() || "";
  const isChannelViewer = currentUser?.role === "CHANNEL_VIEWER";
  const channelId = isChannelViewer ? currentUser?.channelId : null;

  const traceData = searchTerm ? await resolveTraceQuery(searchTerm, channelId) : null;

  return (
    <div className="flex flex-col gap-6 pb-12">
      <TraceSearchHero
        initialQuery={searchTerm}
        isChannelViewer={isChannelViewer}
        channelName={currentUser?.channel?.name}
      />

      {!searchTerm ? (
        <TraceEmptyState />
      ) : !traceData ? (
        <Card className="border-border/80 shadow-xs">
          <CardContent className="py-14 flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground border">
              <SearchX className="size-8" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-md">
              <h3 className="text-base font-bold text-foreground">未检索到溯源档案</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                未检索到单号为 <span className="font-mono font-bold text-foreground">{searchTerm}</span> 的记录。
              </p>
              <p className="text-xs text-muted-foreground">
                支持按订单号、出库单号、快递运单号或原料批次号查询，请核对后重新输入。
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <TraceCertificateHeader data={traceData} />
          <TraceTopologyFlow data={traceData} />
          <TraceAuditLedger data={traceData} />
        </div>
      )}
    </div>
  );
}
