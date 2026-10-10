import { getLedgerData } from "@/lib/ledger-data";
import { LedgerRangeError } from "@/lib/ledger-range";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ExportLedgerButton } from "@/components/ledgers/ExportLedgerButton";
import { LedgerDateFilter } from "@/components/ledgers/LedgerDateFilter";
import { LedgerTabCarousel } from "@/components/ledgers/LedgerTabCarousel";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { FileCheck } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLedgerRange } from "@/lib/ledger-range";
import { countLedgerRows, ledgerNames, ledgerNumber } from "@/lib/ledger-pagination";
import { LedgerLoading } from "@/components/ledgers/LedgerLoading";

export const dynamic = "force-dynamic";

type LedgerCardSectionProps = {
  title: string;
  exportFilename: string;
  exportUrl: string;
  children: ReactNode;
  total: number;
  page: number;
  pageSize: number;
  pageParam: string;
  pageSizeParam: string;
};

function LedgerCardSection({
  title,
  exportFilename,
  exportUrl,
  children,
  total,
  page,
  pageSize,
  pageParam,
  pageSizeParam,
}: LedgerCardSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <ExportLedgerButton
          exportUrl={exportUrl}
          filename={exportFilename}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {children}
        <DataTablePagination
          total={total}
          page={page}
          pageSize={pageSize}
          pageParam={pageParam}
          pageSizeParam={pageSizeParam}
        />
      </CardContent>
    </Card>
  );
}



function LedgerTable({
  headers,
  rows,
  emptyText,
}: {
  headers: string[];
  rows: ReactNode[][];
  emptyText: string;
}) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-max">
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header} className="whitespace-nowrap text-xs">
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={headers.length} className="py-8 text-center text-xs text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="hover:bg-muted/40">
                {row.map((cell, cellIndex) => (
                  <TableCell key={cellIndex} className="whitespace-nowrap text-xs">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

async function LedgerBadges({ params }: { params: Record<string, string | undefined> }) {
  const user = await getCurrentUser();
  const counts = await Promise.all(ledgerNames.map((_, i) => countLedgerRows(prisma, i + 1, params, user)));
  return <LedgerTabCarousel ledgers={ledgerNames.map((name, i) => ({ key: `ledger${i + 1}`, no: i + 1, label: name, count: counts[i] }))} />;
}

async function LedgerContent({ params }: { params: Record<string, string | undefined> }) {
  const { ledgers, outboundMatrixRows, validTab, selectedDateStr, range, showTagLedgerReturns, currentPage, pageSizeFor, matrixHeaders } = await getLedgerData(params);
  return <>
        {ledgers.map((ledger) => {
          const isCurrentTab = ledger.key === validTab;
          if (!isCurrentTab) return <TabsContent key={ledger.key} value={ledger.key}><LedgerLoading /></TabsContent>;
          const page = currentPage;
          const pageSize = pageSizeFor(ledger.no);
          const pagedRows = ledger.rows;
          const isOutboundHeader = ledger.no === 8;
          const pagedOutboundMatrixRows = outboundMatrixRows;
          const exportParams = new URLSearchParams({ start: range.start, end: range.end, tab: ledger.key, ...(params.cat ? { cat: params.cat } : {}) });
          return (
            <TabsContent key={ledger.key} value={ledger.key}>
              <LedgerCardSection
                title={ledger.title}
                exportFilename={`阳澄股份_${ledger.sheet}_${selectedDateStr}`}
                exportUrl={`/api/ledgers/export?${exportParams}`}
                total={ledger.count}
                page={page}
                pageSize={pageSize}
                pageParam={`l${ledger.no}Page`}
                pageSizeParam={`l${ledger.no}PageSize`}
              >
                <div className="flex flex-col gap-4">
                  {ledger.no === 6 && (
                    <p className="text-xs text-muted-foreground">
                      初始分拣只数 − 分拣完成只数 = 机器分拣损耗；损耗由系统自动计算，待分拣任务尚未结算。时间均为北京时间。
                    </p>
                  )}
                  {ledger.no === 3 && (
                    <p className="text-xs text-muted-foreground">
                      当日按北京时间的申领日期统计，每行是一笔申领；入仓数为该养殖户当天入池合计，同日多笔重复展示，请勿重复加总。
                      完成绑扎仅计本笔申领在申领当天实际完成的合格数；退回和作废归属申领日。
                      当日差额＝申领－完成绑扎{showTagLedgerReturns ? "－退回" : ""}－作废。
                      入仓校验按该养殖户当天全部未驳回申领合计比较，异常仅提示。
                    </p>
                  )}
                  <LedgerTable
                    headers={ledger.headers}
                    rows={pagedRows.map((row) => row.displayRow)}
                    emptyText={ledger.empty}
                  />
                  {isOutboundHeader && outboundMatrixRows.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="text-xs font-medium text-muted-foreground">成品出库规格矩阵</div>
                      <LedgerTable
                        headers={matrixHeaders}
                        rows={pagedOutboundMatrixRows as ReactNode[][]}
                        emptyText="暂无出库规格汇总"
                      />
                    </div>
                  )}
                </div>
              </LedgerCardSection>
            </TabsContent>
          );
        })}
  </>;
}

export default async function LedgersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  let range;
  try { range = getLedgerRange(params); }
  catch (error) {
    if (!(error instanceof LedgerRangeError)) throw error;
    return <div className="flex flex-col gap-3"><p role="alert" className="text-destructive">{error.message}</p><a href="/ledgers" className="text-primary underline">重置为最近一个月</a></div>;
  }
  const tab = `ledger${ledgerNumber(params)}`;
  const requestKey = JSON.stringify(params);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground"><FileCheck className="size-6 text-primary" />全链路合规台账</h1>
          <p className="mt-1 text-xs text-muted-foreground">全链路 12 张业务台账，支持各环节穿透追溯与原样数据导出。</p>
        </div>
        <LedgerDateFilter startDate={range.start} endDate={range.end} />
      </div>
      <Tabs key={tab} defaultValue={tab} activationMode="manual" className="flex flex-col gap-4">
        <Suspense key={`counts:${range.start}:${range.end}:${params.cat || ""}`} fallback={<LedgerTabCarousel ledgers={ledgerNames.map((name, i) => ({ key: `ledger${i + 1}`, no: i + 1, label: name, count: null }))} />}>
          <LedgerBadges params={params} />
        </Suspense>
        <Suspense key={requestKey} fallback={<LedgerLoading />}>
          <LedgerContent params={params} />
        </Suspense>
      </Tabs>
    </div>
  );
}
