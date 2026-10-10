import { NextRequest, NextResponse } from "next/server";
import { getLedgerData } from "@/lib/ledger-data";
import { LedgerRangeError } from "@/lib/ledger-range";
import { generateLedgerWorkbook } from "@/lib/excel";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const data = await getLedgerData(Object.fromEntries(request.nextUrl.searchParams), true);
    const ledger = data.ledgers.find(l => l.key === data.validTab)!;
    const rows = ledger.rows.map(row => row.exportRow);
    const workbook = generateLedgerWorkbook({ sheetName: ledger.sheet, headers: ledger.headers, rows,
      sections: ledger.no === 8 ? [{ headers: ledger.headers, rows }, { title: "成品出库规格矩阵", headers: data.matrixHeaders, rows: data.outboundMatrixRows }] : undefined });
    const file = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const filename = `阳澄股份_${ledger.sheet}_${data.range.start}_${data.range.end}.xlsx`;
    return new NextResponse(new Uint8Array(file), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    } });
  } catch (error) {
    if (error instanceof LedgerRangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Ledger export failed", error);
    return NextResponse.json({ error: "导出失败，请稍后重试" }, { status: 500 });
  }
}
