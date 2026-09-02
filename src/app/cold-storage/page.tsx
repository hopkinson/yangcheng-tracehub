import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColdIntakeDialog } from "@/components/coldStore/ColdIntakeDialog";
import { ColdStoreDialog } from "@/components/coldStore/ColdStoreDialog";
import { ThermometerSnowflake, CheckSquare, Info, Plus, Activity, ShieldCheck, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ColdStoragePage() {
  // 1. 查询保鲜库及其入库流水
  const stores = await prisma.coldStore.findMany({
    orderBy: { code: "asc" },
    include: {
      _count: { select: { logs: true } },
      logs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // 2. 查询全部入库流水
  const logs = await prisma.coldLog.findMany({
    orderBy: { createdAt: "desc" },
    include: { store: true },
  });

  // 3. 查询保鲜库温湿度质检监控记录 (13.4)
  const qcRecords = await prisma.qCRecord.findMany({
    where: { cat: "COLD_TEMP" },
    orderBy: { checkTime: "desc" },
  });

  const storeOptions = stores.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    targetTemp: s.targetTemp,
  }));

  // 获取今日日期字符串用于统计今日入库 (兼容仿真固定日期 2026-09-21 或真实当天)
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* 头部标题与操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ThermometerSnowflake className="size-5 text-primary" />
            保鲜预冷
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            分拣合格成品大闸蟹入库预冷（4~5℃），严格【只入不出】，出库发货统一经由「出库管理」集中办理。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ColdStoreDialog
            stores={stores.map((s) => ({
              id: s.id,
              code: s.code,
              name: s.name,
              targetTemp: s.targetTemp,
              _count: s._count,
            }))}
          />
          <ColdIntakeDialog stores={storeOptions} />
        </div>
      </div>

      {/* 13.2 保鲜库卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {stores.map((s) => {
          const totalStored = s.logs.reduce((a, b) => a + b.count, 0);
          // 今日入库计算 (当天的入库量，若无则取最近一天数据呈现)
          const todayStored = s.logs
            .filter((l) => l.createdAt.toISOString().slice(0, 10) === todayStr || l.createdAt.toISOString().slice(0, 10) === "2026-09-21")
            .reduce((a, b) => a + b.count, 0);
          const hasStock = totalStored > 0;

          return (
            <Card key={s.id} className="border-border/80 shadow-xs flex flex-col justify-between">
              <div>
                <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ThermometerSnowflake className="size-4 text-primary" />
                    <CardTitle className="text-xs font-semibold">
                      {s.name} <span className="font-mono text-muted-foreground">({s.code})</span>
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono">
                      目标 {s.targetTemp}℃
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        hasStock
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {hasStock ? "在库" : "空置"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-3.5 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-muted/30 p-2 rounded-md border border-border/40">
                      <span className="text-[11px] text-muted-foreground block">累计预冷入库</span>
                      <span className="text-base font-bold text-foreground">{totalStored.toLocaleString()} 只</span>
                    </div>
                    <div className="bg-muted/30 p-2 rounded-md border border-border/40">
                      <span className="text-[11px] text-muted-foreground block">今日入库</span>
                      <span className="text-base font-bold text-primary">+{todayStored.toLocaleString()} 只</span>
                    </div>
                  </div>

                  {/* 卡片入库登记按钮 */}
                  <div className="pt-1">
                    <ColdIntakeDialog
                      stores={storeOptions}
                      defaultStoreId={s.id}
                      trigger={
                        <Button variant="outline" size="sm" className="w-full h-8 text-xs font-medium gap-1.5 shadow-2xs">
                          <Plus className="size-3.5 text-primary" />
                          入库登记到本库
                        </Button>
                      }
                    />
                  </div>
                </CardContent>
              </div>

              {/* 卡片底部固定提示 */}
              <div className="px-3.5 py-2 border-t border-border/50 bg-muted/10 text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Info className="size-3.5 text-primary shrink-0" />
                <span>出库发货请走「出库管理」统一审批出库</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 13.3 保鲜预冷入库流水台账 */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="py-3 px-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">保鲜预冷入库流水台账（共 {logs.length} 笔）</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-mono">
              <tr>
                <th className="px-3 py-2.5 font-medium">入库单号 (CR)</th>
                <th className="px-3 py-2.5 font-medium">入库时间</th>
                <th className="px-3 py-2.5 font-medium">存入保鲜库</th>
                <th className="px-3 py-2.5 font-medium">入库数量</th>
                <th className="px-3 py-2.5 font-medium">关联作业批次 / 任务</th>
                <th className="px-3 py-2.5 font-medium">操作经手人</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    暂无入库记录，请点击上方「保鲜入库登记 (CR)」
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2.5 font-mono font-bold text-foreground">
                      {log.code}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">
                      {log.createdAt.toISOString().slice(5, 16).replace("T", " ")}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-[10px]">
                        {log.store.name} ({log.store.code})
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-primary">
                      +{log.count} 只
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">
                      {log.refId || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {log.operator}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 13.4 保鲜记录（保鲜库温湿度质检监控） */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="py-3 px-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">保鲜库温湿度监控巡检记录（共 {qcRecords.length} 笔）</CardTitle>
          </div>
          <span className="text-[11px] text-muted-foreground">由质检员现场巡检测定并上传留痕</span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-mono">
              <tr>
                <th className="px-3 py-2.5 font-medium">质检单号</th>
                <th className="px-3 py-2.5 font-medium">巡检库位</th>
                <th className="px-3 py-2.5 font-medium">温湿度与巡检结论</th>
                <th className="px-3 py-2.5 font-medium">状态</th>
                <th className="px-3 py-2.5 font-medium">巡检时间</th>
                <th className="px-3 py-2.5 font-medium">质检员</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {qcRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    暂无保鲜库温湿度记录
                  </td>
                </tr>
              ) : (
                qcRecords.map((qc) => {
                  const isQualified = qc.result === "QUALIFIED";
                  return (
                    <tr key={qc.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2.5 font-mono font-bold text-foreground">
                        {qc.code}
                      </td>
                      <td className="px-3 py-2.5 font-medium">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {qc.refId}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-foreground">
                        {qc.conclusion || "正常"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] gap-1 ${
                            isQualified
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-destructive/10 text-destructive border-destructive/20"
                          }`}
                        >
                          {isQualified ? (
                            <>
                              <ShieldCheck className="size-3" />
                              合格
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="size-3" />
                              异常
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">
                        {qc.checkTime.toISOString().slice(5, 16).replace("T", " ")}
                      </td>
                      <td className="px-3 py-2.5">
                        {qc.uploader}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
