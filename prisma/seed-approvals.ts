import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 开始生成审批中心测试数据...");

  // 1. 获取基础用户与主体
  const warehouseAdmin = await prisma.user.findFirstOrThrow({ where: { role: "WAREHOUSE_ADMIN" } });
  const farmer1 = await prisma.farmer.findFirstOrThrow({ where: { code: "JD-2026-001" }, include: { enclosures: true } });
  const farmer2 = await prisma.farmer.findFirstOrThrow({ where: { code: "JD-2026-002" }, include: { enclosures: true } });
  
  const samsChannel = await prisma.channel.findFirstOrThrow({ where: { code: "SAMS" } });
  const hemaChannel = await prisma.channel.findFirstOrThrow({ where: { code: "HEMA" } });

  const samStore2 = await prisma.store.findFirstOrThrow({ where: { code: "ST-02" } }); // 苏州木渎店
  const hemaStore1 = await prisma.store.findFirstOrThrow({ where: { code: "ST-04" } }); // 苏州中心店
  const hemaStore2 = await prisma.store.findFirstOrThrow({ where: { code: "ST-05" } }); // 上海大宁店

  const pool1 = await prisma.holdingPool.findFirstOrThrow({ where: { code: "ZY-01" } });
  const pool2 = await prisma.holdingPool.findFirstOrThrow({ where: { code: "ZY-02" } });
  const pool3 = await prisma.holdingPool.findFirstOrThrow({ where: { code: "ZY-03" } });

  // 2. 待审核蟹扣领用申请 (TagClaim: PENDING)
  const today = new Date();
  const todayDateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

  // 申请 1: 张阿二申请 800 只 (在池存活充足，符合规则)
  const tagClaim1 = await prisma.tagClaim.create({
    data: {
      code: `XK${todayDateStr}01`,
      claimDate: today,
      farmerId: farmer1.id,
      claimCount: 800,
      boundCount: 0,
      returnedCount: 0,
      scrappedCount: 0,
      isBalanced: false,
      status: "PENDING",
      applicantId: warehouseAdmin.id,
    },
  });

  // 申请 2: 刘金根申请 1200 只
  const tagClaim2 = await prisma.tagClaim.create({
    data: {
      code: `XK${todayDateStr}02`,
      claimDate: today,
      farmerId: farmer2.id,
      claimCount: 1200,
      boundCount: 0,
      returnedCount: 0,
      scrappedCount: 0,
      isBalanced: false,
      status: "PENDING",
      applicantId: warehouseAdmin.id,
    },
  });

  // 申请 3: 张阿二申请 500 只 (早间特快发货备扣)
  const tagClaim3 = await prisma.tagClaim.create({
    data: {
      code: `XK${todayDateStr}03`,
      claimDate: today,
      farmerId: farmer1.id,
      claimCount: 500,
      boundCount: 0,
      returnedCount: 0,
      scrappedCount: 0,
      isBalanced: false,
      status: "PENDING",
      applicantId: warehouseAdmin.id,
    },
  });

  console.log("✅ 成功创建 3 笔待审核蟹扣领用申请:", [tagClaim1.id, tagClaim2.id, tagClaim3.id]);

  // 3. 待审核出库发货单 (OutboundOrder: PENDING)
  const batch1 = await prisma.batch.findFirstOrThrow({ where: { code: "PC-20260901-001" } });
  const batch2 = await prisma.batch.findFirstOrThrow({ where: { code: "PC-20260901-002" } });

  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  // 出库单 1: 发往山姆木渎店 (400 只公蟹 4.0两)
  const outboundOrder1 = await prisma.outboundOrder.create({
    data: {
      code: `CK-${dateStr}-${randomSuffix}1`,
      batchId: batch1.id,
      storeId: samStore2.id,
      channelId: samsChannel.id,
      outboundCount: 400,
      channelOrderCount: 400,
      status: "PENDING",
      applicantId: warehouseAdmin.id,
    },
  });

  // 出库单 2: 发往盒马苏州中心店 (600 只母蟹 3.0两)
  const outboundOrder2 = await prisma.outboundOrder.create({
    data: {
      code: `CK-${dateStr}-${randomSuffix}2`,
      batchId: batch2.id,
      storeId: hemaStore1.id,
      channelId: hemaChannel.id,
      outboundCount: 600,
      channelOrderCount: 600,
      status: "PENDING",
      applicantId: warehouseAdmin.id,
    },
  });

  // 出库单 3: 发往盒马上海大宁店 (300 只母蟹 3.0两，曾驳回后重提)
  const outboundOrder3 = await prisma.outboundOrder.create({
    data: {
      code: `CK-${dateStr}-${randomSuffix}3`,
      batchId: batch2.id,
      storeId: hemaStore2.id,
      channelId: hemaChannel.id,
      outboundCount: 300,
      channelOrderCount: 300,
      status: "PENDING",
      rejectReason: "原报送门店编码有误，已核验盒马大宁店订单重新提报",
      applicantId: warehouseAdmin.id,
    },
  });

  console.log("✅ 成功创建 3 笔待审核出库发货单:", [outboundOrder1.code, outboundOrder2.code, outboundOrder3.code]);

  // 4. 损耗超标异常批次与盘点记录 (isException: true)
  const exBatch1 = await prisma.batch.create({
    data: {
      code: `PC-${dateStr}-EX01`,
      farmerId: farmer2.id,
      enclosureId: farmer2.enclosures[0].id,
      poolId: pool3.id,
      gender: "FEMALE",
      weightTier: "3.5两",
      inPoolTime: new Date(Date.now() - 3600 * 1000 * 48),
      inPoolCount: 3000,
      outPoolCount: 0,
      lossCount: 240, // 240 / 3000 = 8.0%
      status: "TEMPORARY_HOLDING",
      isException: true,
      exceptionReason: "损耗率超 5% 告警：累计损耗率达到 8.00%，已触发品控拦截",
      createdById: warehouseAdmin.id,
    },
  });

  await prisma.lossRecord.create({
    data: {
      batchId: exBatch1.id,
      bookInPool: 3000,
      physicalCount: 2760,
      lossCount: 240,
      cumulativeLoss: 240,
      lossRate: 8.0,
      reason: "3号活水池夜间增氧阀门故障致局部水体溶氧量骤降，引发批量应激死损",
      inspectorId: warehouseAdmin.id,
    },
  });

  const exBatch2 = await prisma.batch.create({
    data: {
      code: `PC-${dateStr}-EX02`,
      farmerId: farmer1.id,
      enclosureId: farmer1.enclosures[0].id,
      poolId: pool1.id,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolTime: new Date(Date.now() - 3600 * 1000 * 24),
      inPoolCount: 2000,
      outPoolCount: 500,
      lossCount: 130, // 130 / 2000 = 6.5%
      status: "PARTIALLY_OUTBOUND",
      isException: true,
      exceptionReason: "损耗率超 5% 告警：累计损耗率达到 6.50%，需品控现场核验",
      createdById: warehouseAdmin.id,
    },
  });

  await prisma.lossRecord.create({
    data: {
      batchId: exBatch2.id,
      bookInPool: 1500,
      physicalCount: 1370,
      lossCount: 130,
      cumulativeLoss: 130,
      lossRate: 6.5,
      reason: "网箱装卸翻扣操作不当导致机械挤压破壳",
      inspectorId: warehouseAdmin.id,
    },
  });

  console.log("✅ 成功创建 2 批损耗超标异常批次及风控待办:", [exBatch1.code, exBatch2.code]);
  console.log("🎉 审批中心仿真测试数据全部生成完毕！");
}

main()
  .catch((e) => {
    console.error("❌ 数据生成失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
