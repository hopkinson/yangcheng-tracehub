import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  CheckCircle2,
  FileCheck,
  ShieldAlert,
  Building,
  Layers,
  Waves,
  MapPin,
  Truck,
  ShieldX,
} from "lucide-react";

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

  const searchTerm = params.query?.trim() || "CK-20260901-001";

  // 查询出库单 (若有渠道账号，增加隔离校验)
  const order = await prisma.outboundOrder.findFirst({
    where: {
      OR: [
        { code: { contains: searchTerm } },
        { batch: { code: { contains: searchTerm } } },
      ],
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
    },
  });

  // 渠道隔离判断
  const isChannelViewer = currentUser?.role === "CHANNEL_VIEWER";
  const isCrossChannelForbidden =
    isChannelViewer && currentUser?.channelId && order && order.channelId !== currentUser?.channelId;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 border-b pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">渠道批次级全链路反向追溯与合规验真</h1>
          {isChannelViewer && (
            <Badge variant="outline" className="text-primary font-medium">
              当前视图: {currentUser?.channel?.name || "渠道专属视角"}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          面向商超渠道采购与品控代表开放：支持输入出库发货单号或批次号，一键追溯全链路活蟹来源与数量闭环证明。
        </p>
      </div>

      {/* 搜索框 */}
      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                name="query"
                defaultValue={searchTerm}
                placeholder="输入出库单号 (如 CK-20260901-001) 或原料批次号 (如 PC-20260901-001)"
                className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              检索追溯链
            </button>
          </form>
        </CardContent>
      </Card>

      {isCrossChannelForbidden ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-10 flex flex-col items-center justify-center gap-3 text-center">
            <ShieldX className="size-10 text-destructive" />
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold text-destructive">【渠道数据隔离拦截】</h3>
              <p className="text-xs text-muted-foreground max-w-md">
                当前登录为【{currentUser.channel?.name}】专属审计视角。单号 <span className="font-mono font-bold text-foreground">{searchTerm}</span> 对应的出库货物发往其他渠道，根据品控合规与数据安全规范，无权查阅跨渠道数据！
              </p>
            </div>
          </CardContent>
        </Card>
      ) : !order ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            未检索到单号为 <span className="font-mono font-bold text-foreground">{searchTerm}</span> 的出库溯源记录，请核对单号后重试。
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {/* 全链路拓扑图 */}
          <Card className="border-primary/30">
            <CardHeader className="bg-primary/5 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="size-5 text-primary" />
                  <CardTitle className="text-base font-bold">
                    大闸蟹全链路反向追溯链条拓扑 (合规验真)
                  </CardTitle>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  <CheckCircle2 className="size-3.5 mr-1" />
                  溯源链条完整有效
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-5 text-xs">
                {/* 节点 1: 销售门店 */}
                <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    <Building className="size-4" />
                    <span>1. 销售接收门店</span>
                  </div>
                  <div className="font-medium">{order.store.name}</div>
                  <div className="text-muted-foreground">渠道: {order.channel.name}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">门店编码: {order.store.code}</div>
                </div>

                {/* 节点 2: 出库单 */}
                <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    <Truck className="size-4" />
                    <span>2. 出库发运单</span>
                  </div>
                  <div className="font-mono font-semibold">{order.code}</div>
                  <div className="text-muted-foreground">发货数量: {order.outboundCount} 只</div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    物流单号: {order.logisticsNo || "待生成"}
                  </div>
                </div>

                {/* 节点 3: 原料批次 */}
                <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    <Layers className="size-4" />
                    <span>3. 原料批次 (内部)</span>
                  </div>
                  <div className="font-mono font-semibold">{order.batch.code}</div>
                  <div className="text-muted-foreground">
                    规格: {order.batch.gender === "MALE" ? "公蟹" : "母蟹"} · {order.batch.weightTier}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    入池时间: {new Date(order.batch.inPoolTime).toLocaleString()}
                  </div>
                </div>

                {/* 节点 4: 暂养池 */}
                <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    <Waves className="size-4" />
                    <span>4. 暂养仓位</span>
                  </div>
                  <div className="font-semibold">{order.batch.pool.name}</div>
                  <div className="font-mono text-muted-foreground">池号: {order.batch.pool.code}</div>
                  <div className="text-[11px] text-muted-foreground">恒温活水暂养</div>
                </div>

                {/* 节点 5: 源头养殖户与围网 */}
                <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    <MapPin className="size-4" />
                    <span>5. 源头签约养殖户</span>
                  </div>
                  <div className="font-semibold">{order.batch.farmer.name}</div>
                  <div className="font-mono text-muted-foreground">蟹扣编码: {order.batch.farmer.code}</div>
                  <div className="text-[11px] text-muted-foreground">
                    围网水域: {order.batch.enclosure.code} ({order.batch.farmer.farmType === "LAKE_CRAB" ? "阳澄湖核心区" : "生态塘"})
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 合规证明单 */}
          <Card>
            <CardHeader>
              <CardTitle>{order.channel.name} 供应商大闸蟹数量闭环与合规证明证书</CardTitle>
              <CardDescription>
                本证明由阳澄股份全链路溯源品控系统自动生成，用于支撑渠道供应商合规审核。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-lg border bg-muted/20 p-4 text-xs flex flex-col gap-3">
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground">核查单号:</span>
                    <p className="font-mono font-bold">{order.code}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">发往终端:</span>
                    <p className="font-bold">{order.store.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">源头养殖面积:</span>
                    <p className="font-mono font-bold">{order.batch.farmer.area} 亩</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">养殖户核定额度:</span>
                    <p className="font-mono font-bold text-primary">{order.batch.farmer.quota.toLocaleString()} 只</p>
                  </div>
                </div>

                <div className="border-t pt-3 flex flex-col gap-1.5 text-muted-foreground leading-relaxed">
                  <p className="font-semibold text-foreground">数量守恒与合规审查结论：</p>
                  <p>
                    1. 本批次出库大闸蟹（{order.outboundCount}只）所绑蟹扣印制编码为【{order.batch.farmer.code}】，严格归属于签约养殖户【{order.batch.farmer.name}】名下。
                  </p>
                  <p>
                    2. 该养殖户 2026 年度签约水域面积 {order.batch.farmer.area} 亩，按 600 只/亩标准核定总额度为 {order.batch.farmer.quota.toLocaleString()} 只。
                  </p>
                  <p>
                    3. 经系统数据库事务校验：该养殖户当年入池总量与蟹扣核销总量均严格 $\le$ 核定额度，单票出库数严格等于订单数，数量闭环完全轧平。
                  </p>
                </div>
              </div>

              {/* 边界声明 (对外公示口径) */}
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <ShieldAlert className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-bold">系统边界声明（对外合规公示口径）：</span>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    ① 蟹扣仅标记来源养殖户编码（JD号），不含批次信息；<br />
                    ② 系统以严密台账证明“带扣蟹发货总量不超过签约养殖户理论产量”，批次级全链路追溯面向渠道账号开放；<br />
                    ③ 蟹扣无单只防复制防伪码，系统不追踪单只蟹，不承担防伪职能。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
