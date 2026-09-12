import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatShortDateTime, getBeijingTimeString } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { BatchReportViewDialog } from "@/components/batches/BatchReportViewDialog";
import {
  InspectionReportDeleteButton,
  InspectionReportDialog,
} from "@/components/reports/InspectionReportDialog";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || "";

  const [currentUser, reports] = await Promise.all([
    getCurrentUser(),
    prisma.inspectionReport.findMany({
      where: query ? { name: { contains: query } } : undefined,
      include: { uploadedBy: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const canManage = ["ADMIN", "QA_DIRECTOR", "WAREHOUSE_ADMIN"].includes(currentUser?.role || "");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">检测报告</h1>
          <p className="mt-1 text-sm text-muted-foreground">按报告名称统一归档各类第三方检测与专项检测材料。</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form action="/reports" className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="按报告名称搜索…"
                className="w-full pl-8 sm:w-72"
              />
            </div>
            <Button type="submit" variant="outline">搜索</Button>
          </form>
          {canManage && <InspectionReportDialog />}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[320px]">报告名称</TableHead>
                <TableHead className="w-[150px]">检测时间</TableHead>
                <TableHead className="w-[150px]">上传时间</TableHead>
                <TableHead className="w-[140px]">上传人</TableHead>
                <TableHead className="min-w-[220px]">附件</TableHead>
                <TableHead className="w-[170px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {query ? "没有找到匹配的检测报告" : "暂无检测报告"}
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => {
                  const inspectedAt = report.inspectedAt
                    ? getBeijingTimeString(report.inspectedAt)?.slice(0, 16).replace(" ", "T") || ""
                    : "";

                  return (
                    <TableRow key={report.id}>
                      <TableCell className="font-semibold">{report.name}</TableCell>
                      <TableCell className="font-mono text-sm">{formatShortDateTime(report.inspectedAt)}</TableCell>
                      <TableCell className="font-mono text-sm">{formatShortDateTime(report.createdAt)}</TableCell>
                      <TableCell>{report.uploadedBy.fullName}</TableCell>
                      <TableCell>
                        <BatchReportViewDialog
                          reportName={report.fileName}
                          reportUrl={report.fileUrl}
                          title={report.name}
                          trigger={
                            <button type="button" className="max-w-[280px] truncate text-left text-sm font-medium text-primary hover:underline">
                              {report.fileName}
                            </button>
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage ? (
                          <div className="flex items-center justify-end gap-2">
                            <InspectionReportDialog
                              report={{
                                id: report.id,
                                name: report.name,
                                fileName: report.fileName,
                                inspectedAt,
                              }}
                            />
                            <InspectionReportDeleteButton id={report.id} name={report.name} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
