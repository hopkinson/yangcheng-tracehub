import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { PrismaClient, type Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();
const rollback = new Error("rollback raw material ledger fixtures");

test("原料台账区分发货和两类损耗，分页与 Excel 导出顺序一致", async () => {
  try {
    await assert.rejects(prisma.$transaction(async (tx) => {
      const key = `raw-ledger-${randomUUID()}`;
      const date = "2091-01-15";
      const user = await tx.user.create({ data: { username: key, phone: key, fullName: key, role: "ADMIN" } });
      const farmer = await tx.farmer.create({ data: { code: key, name: key, phone: key, farmType: "LAKE_CRAB", year: 2091, area: 1, quota: 600 } });
      const enclosure = await tx.enclosure.create({ data: { code: key, farmerId: farmer.id } });
      const pool = await tx.holdingPool.create({ data: { code: key, name: key } });
      const otherPool = await tx.holdingPool.create({ data: { code: `${key}-other`, name: `${key}-other` } });
      const batchRefs = { farmerId: farmer.id, enclosureId: enclosure.id, poolId: pool.id, createdById: user.id };
      const legacy = await tx.batch.create({ data: {
        ...batchRefs, code: `${key}-legacy`, inPoolTime: new Date(`${date}T02:00:00Z`),
        inPoolCount: 100, outPoolCount: 80, lossCount: 20,
      } });
      const batch = await tx.batch.create({ data: {
        ...batchRefs, code: key, inPoolTime: new Date(`${date}T04:00:00Z`),
        items: { create: [
          { id: `${key}-0`, poolId: pool.id, gender: "MALE", weightTier: "3.5两", weight: 42, inPoolCount: 120, outPoolCount: 118, lossCount: 2 },
          ...Array.from({ length: 9 }, (_, i) => ({
            id: `${key}-${i + 1}`, poolId: otherPool.id, gender: "FEMALE", weightTier: "2.5两", weight: i + 1, inPoolCount: 10,
          })).reverse(),
        ] },
      } });
      const claim = await tx.tagClaim.create({ data: { farmerId: farmer.id, applicantId: user.id, claimCount: 120, claimDate: batch.inPoolTime } });
      const group = await tx.bundleGroup.create({ data: { code: key, name: key } });
      const bundle = await tx.bundleBatch.create({ data: {
        code: key, groupId: group.id, sourceBatchId: batch.id, tagClaimId: claim.id, ropeBatch: key,
        lines: { create: { poolId: pool.id, gender: "MALE", weightTier: "3.5两", count: 118, lossCount: 1 } },
      } });
      const machine = await tx.sortMachine.create({ data: { code: key, name: key } });
      const task = await tx.sortTask.create({ data: {
        code: key, machineId: machine.id, bundleBatchId: bundle.id,
        gender: "MALE", weightTier: "3.5两", inputCount: 117, qualifiedCount: 115, lossCount: 2, status: "COMPLETED",
      } });
      const coldStore = await tx.coldStore.create({ data: { code: key, name: key } });
      const cold = await tx.coldLog.create({ data: { code: key, storeId: coldStore.id, sortTaskId: task.id, count: 115, operator: key } });
      const channel = await tx.channel.create({ data: { name: key } });
      const store = await tx.store.create({ data: { code: key, name: key, channelId: channel.id } });
      const orderRefs = { batchId: batch.id, storeId: store.id, channelId: channel.id, applicantId: user.id };
      const line = { coldLogId: cold.id, orderNo: key, gender: "MALE", weightTier: "3.5两" };
      await tx.outboundOrder.create({ data: { ...orderRefs, code: key, status: "APPROVED", lines: { create: { ...line, count: 108 } } } });
      await tx.outboundOrder.create({ data: { ...orderRefs, code: `${key}-rejected`, status: "REJECTED", lines: { create: { ...line, count: 9 } } } });
      await tx.outboundLossRecord.createMany({ data: [
        { lossType: "PACKAGING", count: 3, status: "APPROVED" },
        { lossType: "CLEARANCE", count: 4, status: "APPROVED" },
        { lossType: "PACKAGING", count: 9, status: "REJECTED" },
      ].map(loss => ({ ...loss, coldLogId: cold.id, gender: line.gender, weightTier: line.weightTier, reason: key, operatorId: user.id })) });

      // Use Next's server-side alias and keep application queries inside the fixture transaction.
      const hook = registerHooks({
        resolve(specifier, context, nextResolve) {
          return nextResolve(specifier === "server-only" ? "next/dist/compiled/server-only/empty" : specifier, context);
        },
      });
      const prismaScope = globalThis as typeof globalThis & { prisma?: Prisma.TransactionClient };
      const priorPrisma = prismaScope.prisma;
      prismaScope.prisma = tx;
      try {
        const { getLedgerData } = await import("../src/lib/ledger-data");
        const { GET } = await import("../src/app/api/ledgers/export/route");
        const params = { tab: "ledger2", start: date, end: date };
        const first = (await getLedgerData(params)).ledgers[1];
        const second = (await getLedgerData({ ...params, l2Page: "2" })).ledgers[1];
        assert.equal(first.count, 11);
        assert.deepEqual(first.rows.map(row => row.rowKey), Array.from({ length: 10 }, (_, i) => `${key}-${i}`));
        assert.deepEqual(second.rows.map(row => row.rowKey), [legacy.id]);
        assert.deepEqual(first.rows[0].displayRow.slice(10, 16), [0, 108, 8, "6.67%", 12, "10.00%"]);
        assert.deepEqual(second.rows[0].displayRow.slice(10, 16), [0, 80, 20, "20.00%", 20, "20.00%"]);

        const response = await GET(new NextRequest(`http://localhost/api/ledgers/export?${new URLSearchParams({ ...params, l2Page: "2" })}`));
        assert.equal(response.status, 200);
        const workbook = XLSX.read(await response.arrayBuffer());
        const exported = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["02 原料批次台账"], { header: 1 });
        assert.deepEqual(exported, [first.headers, ...[...first.rows, ...second.rows].map(row => row.exportRow)]);
      } finally {
        prismaScope.prisma = priorPrisma;
        hook.deregister();
      }
      throw rollback;
    }, { timeout: 30_000 }), (error: unknown) => error === rollback);
  } finally {
    await prisma.$disconnect();
  }
});
