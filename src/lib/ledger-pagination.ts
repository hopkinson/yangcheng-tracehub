import { Prisma, type PrismaClient } from "@prisma/client";
import { cache } from "react";
import { getLedgerRange } from "./ledger-range";

export type LedgerParams = Record<string, string | undefined>;
export type LedgerViewer = { role: string; channelId: string | null };
export const ledgerNames = ["养殖户主档", "原料批次", "蟹扣领用", "暂养池流水", "捆扎作业", "分拣作业", "保鲜预冷", "出库单", "出库明细", "品控记录", "门店订单", "提蟹订单"];

export function ledgerNumber(params: LedgerParams) {
  return /^ledger([1-9]|1[0-2])$/.test(params.tab ?? "") ? Number(params.tab!.slice(6)) : 1;
}

export function ledgerPaging(params: LedgerParams, no = ledgerNumber(params)) {
  const rawSize = Number(params[`l${no}PageSize`]);
  const rawPage = Number(params[`l${no}Page`]);
  return {
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 1_000_000) : 1,
    pageSize: [10, 20, 50, 100].includes(rawSize) ? rawSize : 10,
  };
}

// One SQL row per displayed ledger row, including legacy parents without details.
// Only IDs cross this boundary; the existing ledger calculations fetch these parents.
export function ledgerRowQuery(no: number, params: LedgerParams, viewer: LedgerViewer) {
  const channel = viewer.role === "CHANNEL_VIEWER";
  const channelId = viewer.channelId || "__NO_CHANNEL__";
  const range = getLedgerRange(params).filter;
  const date = (column: string) =>
    Prisma.sql`${Prisma.raw(column)} >= ${range.gte} AND ${Prisma.raw(column)} <= ${range.lte}`;
  const outbound = Prisma.sql`p."status" <> 'REJECTED'
    AND ${channel ? Prisma.sql`p."channelId" = ${channelId}` : Prisma.sql`1 = 1`}
    AND (${date('p."createdAt"')} OR ${date('p."outboundTime"')} OR ${date('p."approvedAt"')})`;
  let from: Prisma.Sql;
  let where = Prisma.sql`1 = 1`;
  let key = Prisma.sql`p."id"`;
  let order: Prisma.Sql;
  switch (no) {
    case 1:
      from = Prisma.sql`"Farmer" p`; order = Prisma.sql`p."code" ASC, p."id" ASC`; break;
    case 2:
    case 4:
      from = no === 2
        ? Prisma.sql`"Batch" p LEFT JOIN "BatchItem" c ON c."batchId" = p."id"`
        : Prisma.sql`"Batch" p LEFT JOIN (SELECT DISTINCT "batchId", "poolId" FROM "BatchItem") c ON c."batchId" = p."id" JOIN "HoldingPool" h ON h."id" = COALESCE(c."poolId", p."poolId")`;
      key = no === 2 ? Prisma.sql`COALESCE(c."id", p."id")` : Prisma.sql`p."id" || ':' || h."code"`;
      where = date('p."inPoolTime"');
      order = Prisma.sql`p."inPoolTime" DESC, p."id" ASC, ${key} ASC`; break;
    case 3:
      from = Prisma.sql`"TagClaim" p`; where = date('p."claimDate"');
      order = Prisma.sql`p."claimDate" DESC, p."id" ASC`; break;
    case 5:
      from = Prisma.sql`"BundleBatch" p LEFT JOIN "BundleLine" c ON c."bundleBatchId" = p."id"`;
      key = Prisma.sql`COALESCE(c."id", p."id")`; where = date('p."date"');
      order = Prisma.sql`p."date" DESC, p."createdAt" DESC, p."id" ASC, ${key} ASC`; break;
    case 6:
      from = Prisma.sql`"SortTask" p`; where = date('p."date"');
      order = Prisma.sql`p."date" DESC, p."createdAt" DESC, p."id" ASC`; break;
    case 7:
      from = Prisma.sql`"ColdLog" p`; where = date('p."createdAt"');
      order = Prisma.sql`p."createdAt" DESC, p."id" ASC`; break;
    case 8:
    case 9:
      from = no === 8 ? Prisma.sql`"OutboundOrder" p` : Prisma.sql`"OutboundOrder" p JOIN "OutboundLine" c ON c."outboundOrderId" = p."id"`;
      key = no === 8 ? key : Prisma.sql`c."id"`; where = outbound;
      order = Prisma.sql`p."createdAt" DESC, p."id" ASC, ${key} ASC`; break;
    case 10:
      from = Prisma.sql`"QCRecord" p`;
      where = Prisma.sql`${date('p."checkTime"')} AND ${params.cat ? Prisma.sql`p."cat" = ${params.cat}` : Prisma.sql`1 = 1`}`;
      order = Prisma.sql`p."checkTime" DESC, p."id" ASC`; break;
    case 11:
    case 12:
      from = Prisma.sql`"Order" p LEFT JOIN (
        SELECT l.* FROM "OutboundLine" l JOIN "OutboundOrder" o ON o."id" = l."outboundOrderId"
        WHERE o."status" <> 'REJECTED'
        AND ${channel ? Prisma.sql`o."channelId" = ${channelId}` : Prisma.sql`1 = 1`}
      ) c ON c."orderId" = p."id"`;
      key = Prisma.sql`COALESCE(c."id", p."id")`;
      where = Prisma.sql`p."type" = ${no === 11 ? "STORE_ORDER" : "CRAB_CARD"} AND ${date('p."deliveryDate"')}
        AND ${channel ? Prisma.sql`c."id" IS NOT NULL` : Prisma.sql`1 = 1`}`;
      order = Prisma.sql`p."deliveryDate" DESC, p."importTime" DESC, p."id" ASC, ${key} ASC`; break;
    default: throw new Error("无效台账");
  }
  if (channel && no <= 7) where = Prisma.sql`1 = 0`;
  return { from, where, key, order };
}

type Database = Pick<PrismaClient, "$queryRaw">;
export async function countLedgerRows(db: Database, no: number, params: LedgerParams, viewer: LedgerViewer) {
  const range = getLedgerRange(params);
  return countLedgerRowsForRequest(db, no, range.start, range.end, params.cat, viewer.role, viewer.channelId);
}

// Primitive filter arguments let badges and pagination share one count within a request.
const countLedgerRowsForRequest = cache(async (db: Database, no: number, start: string, end: string, cat: string | undefined, role: string, channelId: string | null) => {
  const q = ledgerRowQuery(no, { start, end, cat }, { role, channelId });
  const [result] = await db.$queryRaw<{ total: bigint | number }[]>(Prisma.sql`SELECT COUNT(*) AS total FROM ${q.from} WHERE ${q.where}`);
  return Number(result.total);
});

export async function getLedgerRowPage(db: Database, no: number, params: LedgerParams, viewer: LedgerViewer, exportAll = false) {
  const q = ledgerRowQuery(no, params, viewer);
  const total = await countLedgerRows(db, no, params, viewer);
  const paging = ledgerPaging(params, no);
  const page = Math.min(paging.page, Math.max(1, Math.ceil(total / paging.pageSize)));
  const limit = exportAll ? Prisma.empty : Prisma.sql`LIMIT ${paging.pageSize} OFFSET ${(page - 1) * paging.pageSize}`;
  const rows = await db.$queryRaw<{ parentId: string; rowKey: string }[]>(Prisma.sql`
    SELECT p."id" AS "parentId", ${q.key} AS "rowKey" FROM ${q.from} WHERE ${q.where} ORDER BY ${q.order} ${limit}`);
  return { rows, total, page, pageSize: paging.pageSize };
}
