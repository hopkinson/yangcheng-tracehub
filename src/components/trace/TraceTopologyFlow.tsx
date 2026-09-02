"use client";

import * as React from "react";
import {
  Layers,
  MapPin,
  Waves,
  PackageCheck,
  Cpu,
  ThermometerSnowflake,
  Truck,
  ShieldCheck,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TraceQueryResult, TraceLineDetail, TraceChainNode, TraceQCBadge } from "@/lib/trace-service";

interface TraceTopologyFlowProps {
  data: TraceQueryResult;
}

const STAGE_ICONS: Record<string, React.ElementType> = {
  原料: MapPin,
  暂养: Waves,
  捆扎: PackageCheck,
  分拣: Cpu,
  预冷: ThermometerSnowflake,
  出库: Truck,
};

const STAGE_COLORS: Record<string, { bg: string; border: string; accent: string; text: string }> = {
  原料: { bg: "bg-emerald-500/5", border: "border-emerald-500/30", accent: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  暂养: { bg: "bg-cyan-500/5", border: "border-cyan-500/30", accent: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400" },
  捆扎: { bg: "bg-purple-500/5", border: "border-purple-500/30", accent: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400" },
  分拣: { bg: "bg-indigo-500/5", border: "border-indigo-500/30", accent: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400" },
  预冷: { bg: "bg-sky-500/5", border: "border-sky-500/30", accent: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400" },
  出库: { bg: "bg-amber-500/5", border: "border-amber-500/30", accent: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
};

export function TraceTopologyFlow({ data }: TraceTopologyFlowProps) {
  const { lines, isPreview } = data;
  const [activeLineIndex, setActiveLineIndex] = React.useState(0);
  const [selectedQC, setSelectedQC] = React.useState<TraceQCBadge | null>(null);

  const activeLine: TraceLineDetail | undefined = lines[activeLineIndex] || lines[0];

  if (!activeLine) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* 头部导航与明细行切分 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">
            六环节时间线溯源链
          </h3>
          {isPreview && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[11px]">
              按规格履约预览
            </Badge>
          )}
        </div>

        {/* 多行明细切换 Tabs */}
        {lines.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-muted-foreground shrink-0 mr-1 flex items-center gap-1">
              <Layers className="size-3.5" />
              明细行 ({lines.length}):
            </span>
            {lines.map((line, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveLineIndex(idx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer border ${
                  activeLineIndex === idx
                    ? "bg-primary text-primary-foreground font-bold border-primary shadow-xs"
                    : "bg-background text-muted-foreground hover:text-foreground border-border"
                }`}
              >
                明细 {line.lineIndex} ({line.weightTier} · {line.gender === "MALE" ? "公" : "母"})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 当前明细行规格摘要 */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          当前链路：{activeLine.specTitle}
        </span>
        <span className="font-mono text-[11px]">
          链路穿透环节: 6/6 全覆盖
        </span>
      </div>

      {/* 时间线样式展开六环节 */}
      <div className="relative flex flex-col gap-4 before:absolute before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-border/80 pl-2 sm:pl-0">
        {activeLine.chain.map((node: TraceChainNode) => {
          const Icon = STAGE_ICONS[node.stageName] || ShieldCheck;
          const styling = STAGE_COLORS[node.stageName] || STAGE_COLORS["原料"];

          return (
            <div
              key={node.step}
              className={`relative flex flex-col sm:flex-row gap-4 p-4 rounded-xl border ${styling.border} ${styling.bg} shadow-xs`}
            >
              {/* 环节序号与图标徽标 */}
              <div className="flex sm:flex-col items-center gap-2 sm:gap-1 shrink-0 sm:w-20">
                <div className={`size-9 rounded-xl border ${styling.accent} ${styling.text} flex items-center justify-center font-bold font-mono text-sm shadow-xs`}>
                  {node.step}
                </div>
                <span className="font-bold text-xs text-foreground tracking-tight">
                  {node.stageName}环节
                </span>
              </div>

              {/* 核心内容区 */}
              <div className="flex-1 flex flex-col gap-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <Icon className={`size-4 ${styling.text}`} />
                      {node.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {node.subtitle}
                    </p>
                  </div>
                  {node.status === "PREVIEW" ? (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] self-start sm:self-auto font-mono">
                      模拟推演
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] self-start sm:self-auto font-mono">
                      已留痕核验
                    </Badge>
                  )}
                </div>

                {/* 明细键值对网格 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-background/80 rounded-lg p-2.5 border border-border/50">
                  {node.details.map((d, dIdx) => (
                    <div key={dIdx} className="min-w-0">
                      <span className="text-muted-foreground text-[10px] block">{d.label}</span>
                      <span className="font-medium text-foreground text-[11px] truncate block" title={d.value}>
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 品控记录徽标随链展示 */}
                {node.qcBadges && node.qcBadges.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                      <FileCheck className="size-3 text-primary" />
                      品控记录:
                    </span>
                    {node.qcBadges.map((qc) => (
                      <button
                        key={qc.id}
                        type="button"
                        onClick={() => setSelectedQC(qc)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono border transition-colors cursor-pointer ${
                          qc.result === "QUALIFIED"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/20"
                        }`}
                      >
                        <span className="size-1.5 rounded-full bg-current" />
                        <span>{qc.title}</span>
                        <span className="font-sans text-[10px] font-bold">
                          [{qc.result === "QUALIFIED" ? "合格" : "异常整改"}]
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 品控记录详情弹窗 */}
      <Dialog open={!!selectedQC} onOpenChange={(open) => !open && setSelectedQC(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileCheck className="size-4 text-primary" />
              {selectedQC?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              业务编号: <span className="font-mono">{selectedQC?.code}</span> · 表号: <span className="font-mono">{selectedQC?.formNo || "规范留痕"}</span>
            </DialogDescription>
          </DialogHeader>

          {selectedQC && (
            <div className="flex flex-col gap-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg border">
                <div>
                  <span className="text-muted-foreground text-[11px]">质检结论</span>
                  <div className="font-bold text-sm mt-0.5">
                    {selectedQC.result === "QUALIFIED" ? (
                      <span className="text-emerald-600 dark:text-emerald-400">核验合格</span>
                    ) : (
                      <span className="text-destructive">异常 (已整改闭环)</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">质检员 / 巡检时间</span>
                  <div className="font-medium text-foreground mt-0.5">
                    {selectedQC.uploader} · {new Date(selectedQC.checkTime).toLocaleDateString("zh-CN")}
                  </div>
                </div>
              </div>

              {selectedQC.conclusion && (
                <div className="rounded-lg border p-2.5 bg-background">
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1">
                    核检结论与描述：
                  </div>
                  <p className="text-foreground leading-relaxed text-xs">
                    {selectedQC.conclusion}
                  </p>
                </div>
              )}

              {selectedQC.reason && (
                <div className="rounded-lg border border-destructive/30 p-2.5 bg-destructive/5 text-destructive">
                  <div className="text-[11px] font-semibold flex items-center gap-1 mb-1">
                    <AlertCircle className="size-3" />
                    异常说明与整改闭环：
                  </div>
                  <p className="leading-relaxed text-xs">
                    {selectedQC.reason}
                  </p>
                </div>
              )}

              {selectedQC.fileName && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-md border">
                  <span>原始表单凭证附件:</span>
                  <span className="font-mono text-foreground font-medium flex items-center gap-1">
                    {selectedQC.fileName}
                  </span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
