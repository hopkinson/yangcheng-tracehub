import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { countLedgerRows, getLedgerRowPage, ledgerPaging } from "../src/lib/ledger-pagination";

const prisma = new PrismaClient();
const rollback = new Error("rollback pagination fixtures");

async function main() {
  assert.deepEqual(ledgerPaging({ tab: "ledger12", l12Page: "1.5", l12PageSize: "100000" }), { page: 1, pageSize: 10 });
  try {
    await prisma.$transaction(async (tx) => {
      const suffix = `pagination-${Date.now()}`;
      const date = new Date("2090-01-15T04:00:00Z");
      const params = { start: "2090-01-15", end: "2090-01-15" };
      const viewer = { role: "ADMIN", channelId: null };
      const user = await tx.user.create({ data: { username: suffix, phone: suffix, fullName: suffix, role: "ADMIN" } });
      const farmer = await tx.farmer.create({ data: { code: suffix, name: suffix, phone: suffix, farmType: "LAKE_CRAB", year: 2090, area: 1, quota: 600 } });
      const enclosure = await tx.enclosure.create({ data: { code: suffix, farmerId: farmer.id } });
      const pool = await tx.holdingPool.create({ data: { code: suffix, name: suffix } });
      const batchData = { farmerId: farmer.id, enclosureId: enclosure.id, poolId: pool.id, createdById: user.id, inPoolTime: date };
      const batch = await tx.batch.create({ data: { ...batchData, code: suffix,
        items: { create: Array.from({ length: 11 }, (_, i) => ({ id: `${suffix}-item-${String(i).padStart(2, "0")}`, poolId: pool.id, gender: "MALE", weightTier: "4.0两", inPoolCount: 1 })) },
      } });
      await tx.batch.create({ data: { ...batchData, code: `${suffix}-legacy` } });
      const claim = await tx.tagClaim.create({ data: { farmerId: farmer.id, applicantId: user.id, claimDate: date, claimCount: 100 } });
      const group = await tx.bundleGroup.create({ data: { code: suffix, name: suffix } });
      const bundle = await tx.bundleBatch.create({ data: { code: suffix, date, groupId: group.id, sourceBatchId: batch.id, tagClaimId: claim.id, ropeBatch: suffix } });
      const machine = await tx.sortMachine.create({ data: { code: suffix, name: suffix } });
      const task = await tx.sortTask.create({ data: { code: suffix, date, machineId: machine.id, bundleBatchId: bundle.id, gender: "MALE", weightTier: "4.0两", inputCount: 100 } });
      const store = await tx.coldStore.create({ data: { code: suffix, name: suffix } });
      const cold = await tx.coldLog.create({ data: { code: suffix, storeId: store.id, sortTaskId: task.id, count: 100, operator: suffix, createdAt: date } });
      const channel = await tx.channel.create({ data: { name: suffix } });
      const otherChannel = await tx.channel.create({ data: { name: `${suffix}-other` } });
      const shop = await tx.store.create({ data: { code: suffix, name: suffix, channelId: channel.id } });
      const outboundData = { batchId: batch.id, storeId: shop.id, channelId: channel.id, applicantId: user.id, createdAt: date, outboundTime: date };
      const outbound = await tx.outboundOrder.create({ data: { ...outboundData, code: suffix } });
      const otherOutbound = await tx.outboundOrder.create({ data: { ...outboundData, channelId: otherChannel.id, code: `${suffix}-other` } });
      const rejected = await tx.outboundOrder.create({ data: { ...outboundData, code: `${suffix}-rejected`, status: "REJECTED" } });
      const orderData = { importId: suffix, gender: "MALE", weightTier: "4.0两", count: 100, deliveryDate: date, importTime: date };
      const order = await tx.order.create({ data: { ...orderData, code: suffix, orderNo: suffix, type: "CRAB_CARD" } });
      const legacy = await tx.order.create({ data: { ...orderData, code: `${suffix}-legacy`, orderNo: suffix, type: "CRAB_CARD" } });
      await tx.order.create({ data: { ...orderData, code: `${suffix}-store`, orderNo: suffix, type: "STORE_ORDER" } });
      for (let i = 0; i < 11; i++) {
        await tx.outboundLine.create({ data: { id: `${suffix}-line-${String(i).padStart(2, "0")}`, outboundOrderId: outbound.id, orderId: order.id, orderNo: suffix, coldLogId: cold.id, gender: "MALE", weightTier: "4.0两", count: 1 } });
      }
      for (const parent of [otherOutbound, rejected]) {
        await tx.outboundLine.create({ data: { outboundOrderId: parent.id, orderId: order.id, orderNo: suffix, coldLogId: cold.id, gender: "MALE", weightTier: "4.0两", count: 1 } });
      }
      await tx.qCRecord.create({ data: { code: suffix, cat: "QUICK_CHECK", refType: "BATCH", refId: batch.id, title: suffix, checkTime: date, uploader: suffix } });

      // Every ledger query must execute, including fallback rows and grouped pools.
      const totals = await Promise.all(Array.from({ length: 12 }, (_, i) => countLedgerRows(tx, i + 1, params, viewer)));
      assert.deepEqual(totals.slice(1), [12, 1, 2, 1, 1, 1, 2, 12, 1, 1, 13]);
      for (const no of [2, 12]) {
        const all = await getLedgerRowPage(tx, no, params, viewer, true);
        const first = await getLedgerRowPage(tx, no, params, viewer);
        const second = await getLedgerRowPage(tx, no, { ...params, [`l${no}Page`]: "2" }, viewer);
        assert.equal(first.rows.length, 10);
        assert.deepEqual([...first.rows, ...second.rows], all.rows, "分页拼接必须与导出行顺序一致");
        assert.equal(new Set(all.rows.map(row => row.rowKey)).size, all.total);
        const last = await getLedgerRowPage(tx, no, { ...params, [`l${no}Page`]: "999" }, viewer);
        assert.equal(last.page, 2);
      }
      const channelViewer = { role: "CHANNEL_VIEWER", channelId: channel.id };
      assert.equal(await countLedgerRows(tx, 12, params, channelViewer), 11, "不能加载其他渠道明细或无关联订单");
      assert.equal(await countLedgerRows(tx, 1, params, channelViewer), 0);
      assert.equal(await countLedgerRows(tx, 12, params, { role: "CHANNEL_VIEWER", channelId: null }), 0);
      const all = await getLedgerRowPage(tx, 12, params, viewer, true);
      assert.ok(all.rows.some(row => row.rowKey === legacy.id), "无出库明细的订单保留一行");
      assert.equal(await countLedgerRows(tx, 10, { ...params, cat: "WAYBILL" }, viewer), 0);
      assert.equal(await countLedgerRows(tx, 12, { start: "2090-01-16", end: "2090-01-16" }, viewer), 0);
      throw rollback;
    }, { timeout: 30000 });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
  console.log("✔ 台账数据库分页：12 类查询、跨页拆单、旧数据兜底、导出顺序、渠道和日期过滤通过（数据已回滚）");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
