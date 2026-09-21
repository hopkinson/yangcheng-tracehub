import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { requestTagClaimAction, settleDailyTagClaimAction } from "../src/actions/tags";
import { createBundleBatchAction, completeBundleBatchAction } from "../src/actions/production";
import { approveOutboundOrderAction } from "../src/actions/approvals";

async function main() {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const admin = await prisma.user.create({
    data: {
      username: `tag_rule_${suffix}`,
      phone: `136${String(Date.now()).slice(-8)}`,
      fullName: "蟹扣规则测试管理员",
      role: "ADMIN",
    },
  });

  const farmer = await prisma.farmer.create({
    data: {
      code: `JD-TAG-${suffix}`,
      name: `蟹扣规则测试户-${suffix}`,
      phone: `135${String(Date.now()).slice(-8)}`,
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 10,
      quota: 1000,
    },
  });
  const enclosure = await prisma.enclosure.create({
    data: { code: `W-TAG-${suffix}`, farmerId: farmer.id },
  });
  const pool = await prisma.holdingPool.create({
    data: {
      code: `ZY-TAG-${suffix}`,
      name: `蟹扣规则测试池-${suffix}`,
      currentGender: "MALE",
      currentWeightTier: "4.0两",
    },
  });
  const batch = await prisma.batch.create({
    data: {
      code: `YLTAG${suffix}`,
      farmerId: farmer.id,
      enclosureId: enclosure.id,
      poolId: pool.id,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolTime: new Date("1800-01-01T00:00:00.000Z"),
      inPoolCount: 500,
      createdById: admin.id,
      items: {
        create: [{ poolId: pool.id, gender: "MALE", weightTier: "4.0两", inPoolCount: 500 }],
      },
    },
  });
  const group = await prisma.bundleGroup.create({
    data: { code: `P-TAG-${suffix}`, name: `蟹扣规则测试组-${suffix}` },
  });

  let claimId: string | null = null;
  try {
    console.log("▶ [1/6] 蟹扣申请受蟹扣入仓-申领数+退回数硬卡控");
    const requested = await requestTagClaimAction({
      farmerId: farmer.id,
      claimCount: 500,
      applicantId: admin.id,
    });
    claimId = requested.id;
    assert.equal(requested.claimCount, 500);
    assert.equal(requested.status, "PENDING");
    console.log("  ✔ 入仓 500 只，成功按入仓上限申请 500 个蟹扣");

    await prisma.tagClaim.update({ where: { id: requested.id }, data: { status: "APPROVED" } });

    console.log("▶ [2/6] 创建捆扎不扣 boundCount");
    const created = await createBundleBatchAction({
      batchId: batch.id,
      groupId: group.id,
      tagClaimId: requested.id,
      ropeBatch: `XS-TAG-${suffix}`,
      lines: [{ poolId: pool.id, gender: "MALE", weightTier: "4.0两", count: 100 }],
    });
    assert.equal(created.success, true, created.message);
    assert.ok(created.code);

    const claimAfterCreate = await prisma.tagClaim.findUniqueOrThrow({ where: { id: requested.id } });
    assert.equal(claimAfterCreate.boundCount, 0, "BUNDLING 阶段不得提前扣减蟹扣");
    const bundle = await prisma.bundleBatch.findFirstOrThrow({
      where: { sourceBatchId: batch.id, tagClaimId: requested.id },
      include: { lines: true },
    });
    assert.equal(bundle.status, "BUNDLING");
    console.log("  ✔ 创建捆扎后 boundCount 仍为 0");

    console.log("▶ [3/6] 完成捆扎仅按合格只数扣减");
    const completed = await completeBundleBatchAction(bundle.id, [
      { lineId: bundle.lines[0].id, qualifiedCount: 95 },
    ]);
    assert.equal(completed.success, true, completed.message);
    const claimAfterComplete = await prisma.tagClaim.findUniqueOrThrow({ where: { id: requested.id } });
    assert.equal(claimAfterComplete.boundCount, 95, "完成捆扎应只扣最终合格 95 只");
    assert.equal(claimAfterComplete.scrappedCount, 0, "5 只捆扎损耗不得自动记为坏扣");
    console.log("  ✔ 完成 95 只后 boundCount = 95，捆扎损耗未自动作废蟹扣");

    console.log("▶ [4/6] 重复完成不得二次扣减");
    const duplicate = await completeBundleBatchAction(bundle.id, [
      { lineId: bundle.lines[0].id, qualifiedCount: 95 },
    ]);
    assert.equal(duplicate.success, false, "重复完成必须被拦截");
    const claimAfterDuplicate = await prisma.tagClaim.findUniqueOrThrow({ where: { id: requested.id } });
    assert.equal(claimAfterDuplicate.boundCount, 95, "重复完成后 boundCount 不得再次增加");
    console.log("  ✔ 重复完成被拦截，boundCount 仍为 95");

    console.log("▶ [5/6] 出库审批不得再次扣减 boundCount");
    const qaTier = `QA-${suffix}`;
    const machine = await prisma.sortMachine.create({
      data: { code: `FJ-TAG-${suffix}`, name: `蟹扣出库回归机-${suffix}`, status: "ACTIVE" },
    });
    const sortTask = await prisma.sortTask.create({
      data: {
        code: `FJR-TAG-${suffix}`,
        machineId: machine.id,
        bundleBatchId: bundle.id,
        gender: "MALE",
        weightTier: qaTier,
        inputCount: 10,
        qualifiedCount: 10,
        status: "COMPLETED",
      },
    });
    const coldStore = await prisma.coldStore.create({
      data: { code: `BX-TAG-${suffix}`, name: `蟹扣出库回归库-${suffix}` },
    });
    const coldLog = await prisma.coldLog.create({
      data: {
        code: `CR-TAG-${suffix}`,
        storeId: coldStore.id,
        type: "INTAKE",
        count: 10,
        sortTaskId: sortTask.id,
        operator: "测试仓管",
      },
    });
    const channel = await prisma.channel.create({
      data: { name: `蟹扣出库回归渠道-${suffix}` },
    });
    const store = await prisma.store.create({
      data: { code: `ST-TAG-${suffix}`, name: `蟹扣出库回归门店-${suffix}`, channelId: channel.id },
    });
    const outbound = await prisma.outboundOrder.create({
      data: {
        code: `CK-TAG-${suffix}`,
        storeId: store.id,
        channelId: channel.id,
        coldLogId: coldLog.id,
        batchId: batch.id,
        outboundCount: 10,
        channelOrderCount: 10,
        status: "PENDING",
        applicantId: admin.id,
        lines: {
          create: [{ orderNo: `QA-ORDER-${suffix}`, gender: "MALE", weightTier: qaTier, count: 10, coldLogId: coldLog.id }],
        },
      },
    });
    await approveOutboundOrderAction({ orderId: outbound.id, approved: true, comment: "回归测试" });
    const claimAfterOutbound = await prisma.tagClaim.findUniqueOrThrow({ where: { id: requested.id } });
    assert.equal(claimAfterOutbound.boundCount, 95, "出库审批不得再次增加 boundCount");
    console.log("  ✔ 出库审批完成后 boundCount 仍为 95");

    console.log("▶ [6/6] 日结不能手工修改 boundCount");
    const settled = await settleDailyTagClaimAction({
      tagClaimId: requested.id,
      returnedCount: 400,
      returnReason: "测试退回",
      scrappedCount: 5,
      scrapReason: "测试坏扣",
      operatorId: admin.id,
      boundCount: 499,
    } as any);
    assert.equal(settled.boundCount, 95, "即使绕过 TS 传入 boundCount，服务端也必须忽略");
    assert.equal(settled.returnedCount, 400);
    assert.equal(settled.scrappedCount, 5);
    assert.equal(settled.isBalanced, true);
    console.log("  ✔ 日结只登记退回/作废，boundCount 保持系统完成绑扎值 95");

    console.log("\n✔ 蟹扣领用 / 捆扎完成扣减 / 幂等 / 出库不重复扣减 / 日结不可手改 全链路验收通过");
  } finally {
    await prisma.outboundLine.deleteMany({ where: { outboundOrder: { batchId: batch.id } } }).catch(() => {});
    await prisma.outboundOrder.deleteMany({ where: { batchId: batch.id } }).catch(() => {});
    await prisma.coldLog.deleteMany({ where: { code: { startsWith: `CR-TAG-${suffix}` } } }).catch(() => {});
    await prisma.sortTask.deleteMany({ where: { code: { startsWith: `FJR-TAG-${suffix}` } } }).catch(() => {});
    await prisma.sortMachine.deleteMany({ where: { code: { startsWith: `FJ-TAG-${suffix}` } } }).catch(() => {});
    await prisma.store.deleteMany({ where: { code: { startsWith: `ST-TAG-${suffix}` } } }).catch(() => {});
    await prisma.channel.deleteMany({ where: { name: `蟹扣出库回归渠道-${suffix}` } }).catch(() => {});
    await prisma.coldStore.deleteMany({ where: { code: { startsWith: `BX-TAG-${suffix}` } } }).catch(() => {});
    await prisma.bundleLine.deleteMany({ where: { bundleBatch: { sourceBatchId: batch.id } } }).catch(() => {});
    await prisma.bundleBatch.deleteMany({ where: { sourceBatchId: batch.id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { operatorId: admin.id } }).catch(() => {});
    if (claimId) await prisma.tagClaim.delete({ where: { id: claimId } }).catch(() => {});
    await prisma.bundleGroup.delete({ where: { id: group.id } }).catch(() => {});
    await prisma.batchItem.deleteMany({ where: { batchId: batch.id } }).catch(() => {});
    await prisma.batch.delete({ where: { id: batch.id } }).catch(() => {});
    await prisma.holdingPool.delete({ where: { id: pool.id } }).catch(() => {});
    await prisma.enclosure.delete({ where: { id: enclosure.id } }).catch(() => {});
    await prisma.farmer.delete({ where: { id: farmer.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: admin.id } }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
