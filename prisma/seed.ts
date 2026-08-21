import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 开始初始化阳澄大闸蟹溯源系统仿真数据...");

  // 1. 清理历史数据
  await prisma.specialApproval.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.lossRecord.deleteMany();
  await prisma.outboundOrder.deleteMany();
  await prisma.tagClaim.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.holdingPool.deleteMany();
  await prisma.enclosure.deleteMany();
  await prisma.farmer.deleteMany();
  await prisma.store.deleteMany();
  await prisma.user.deleteMany();
  await prisma.channel.deleteMany();

  // 2. 销售渠道与门店
  const sams = await prisma.channel.create({
    data: {
      code: "SAMS",
      name: "山姆会员商店",
      stores: {
        create: [
          { code: "ST-01", name: "山姆会员店 (苏州邻瑞广场店)" },
          { code: "ST-02", name: "山姆会员店 (苏州木渎店)" },
          { code: "ST-03", name: "山姆会员店 (上海青浦旗舰店)" },
        ],
      },
    },
    include: { stores: true },
  });

  const hema = await prisma.channel.create({
    data: {
      code: "HEMA",
      name: "盒马鲜生",
      stores: {
        create: [
          { code: "ST-04", name: "盒马鲜生 (苏州中心店)" },
          { code: "ST-05", name: "盒马鲜生 (上海大宁店)" },
        ],
      },
    },
  });

  // 3. 用户与角色 (初始密码为手机号后6位)
  const admin = await prisma.user.create({
    data: {
      username: "admin",
      phone: "13800000001",
      passwordHash: "000001",
      fullName: "系统超级管理员",
      role: "ADMIN",
    },
  });
  const farmerAdmin = await prisma.user.create({
    data: {
      username: "farmer_mgr",
      phone: "13800000002",
      passwordHash: "000002",
      fullName: "王建国 (养殖户专员)",
      role: "FARMER_ADMIN",
    },
  });
  const warehouseAdmin = await prisma.user.create({
    data: {
      username: "warehouse_mgr",
      phone: "13800000003",
      passwordHash: "000003",
      fullName: "李仓管 (仓库主管)",
      role: "WAREHOUSE_ADMIN",
    },
  });
  const qaDirector = await prisma.user.create({
    data: {
      username: "qa_lead",
      phone: "13800000004",
      passwordHash: "000004",
      fullName: "赵品控 (品控总监)",
      role: "QA_DIRECTOR",
    },
  });
  const samsViewer = await prisma.user.create({
    data: {
      username: "sams_audit",
      phone: "13800000005",
      passwordHash: "000005",
      fullName: "陈审计 (山姆品控代表)",
      role: "CHANNEL_VIEWER",
      channelId: sams.id,
    },
  });

  // 4. 养殖户与围网
  const farmer1 = await prisma.farmer.create({
    data: {
      code: "JD-2026-001",
      name: "张阿二 (阳澄湖东湖基地)",
      phone: "13812345678",
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 100.0,
      quota: 60000, // 100 * 600
      creditRating: "A",
      status: "ACTIVE",
      enclosures: {
        create: [
          { code: "W-01", description: "阳澄湖东湖1号主养殖围网" },
          { code: "W-02", description: "阳澄湖东湖2号深水育肥网" },
        ],
      },
    },
    include: { enclosures: true },
  });

  const farmer2 = await prisma.farmer.create({
    data: {
      code: "JD-2026-002",
      name: "刘金根 (阳澄湖中湖示范区)",
      phone: "13987654321",
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 50.0,
      quota: 30000, // 50 * 600
      creditRating: "A",
      status: "ACTIVE",
      enclosures: {
        create: [{ code: "W-03", description: "阳澄湖中湖生态养殖网" }],
      },
    },
    include: { enclosures: true },
  });

  // 5. 暂养池主档 (按规格复用)
  const pool1 = await prisma.holdingPool.create({
    data: { code: "ZY-01", name: "1号恒温暂养池", currentGender: "MALE", currentWeightTier: "4.0两" },
  });
  const pool2 = await prisma.holdingPool.create({
    data: { code: "ZY-02", name: "2号恒温暂养池", currentGender: "FEMALE", currentWeightTier: "3.0两" },
  });
  const pool3 = await prisma.holdingPool.create({
    data: { code: "ZY-03", name: "3号备用活水池", currentGender: null, currentWeightTier: null },
  });

  // 6. 原料批次 (入库即入池)
  const batch1 = await prisma.batch.create({
    data: {
      code: "PC-20260901-001",
      farmerId: farmer1.id,
      enclosureId: farmer1.enclosures[0].id,
      poolId: pool1.id,
      gender: "MALE",
      weightTier: "4.0两",
      inPoolTime: new Date("2026-09-01T08:30:00Z"),
      inPoolCount: 5000,
      outPoolCount: 2000,
      lossCount: 50,
      status: "PARTIALLY_OUTBOUND",
      reportUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'><rect width='600' height='400' fill='%23f8fafc'/><rect x='20' y='20' width='560' height='360' fill='none' stroke='%230284c7' stroke-width='3'/><text x='300' y='80' font-size='22' font-family='sans-serif' font-weight='bold' text-anchor='middle' fill='%230f172a'>阳澄湖大闸蟹药残专项检测合格报告</text><text x='300' y='120' font-size='14' font-family='sans-serif' text-anchor='middle' fill='%2364748b'>苏州市农业检验检测中心 · 产地准出合格证</text><line x1='50' y1='140' x2='550' y2='140' stroke='%23cbd5e1'/><text x='70' y='180' font-size='14' font-family='sans-serif' fill='%23334155'>送检批次：PC-20260901-001</text><text x='70' y='210' font-size='14' font-family='sans-serif' fill='%23334155'>养殖来源：周阿二 (阳澄湖东湖核心区)</text><text x='70' y='240' font-size='14' font-family='sans-serif' fill='%23334155'>检测项目：氯霉素、孔雀石绿、呋喃唑酮代谢物</text><text x='70' y='270' font-size='14' font-family='sans-serif' font-weight='bold' fill='%2316a34a'>检测结论：未检出超标残留，全部符合国家无公害水产食品标准 (合格)</text><circle cx='480' cy='300' r='45' fill='none' stroke='%23dc2626' stroke-width='2'/><text x='480' y='305' font-size='14' font-family='sans-serif' font-weight='bold' text-anchor='middle' fill='%23dc2626'>检验合格章</text></svg>",
      reportName: "PC-20260901-001_药残检测合格报告.png",
      reportUploadedAt: new Date("2026-09-01T08:45:00Z"),
      createdById: warehouseAdmin.id,
    },
  });

  const batch2 = await prisma.batch.create({
    data: {
      code: "PC-20260901-002",
      farmerId: farmer2.id,
      enclosureId: farmer2.enclosures[0].id,
      poolId: pool2.id,
      gender: "FEMALE",
      weightTier: "3.0两",
      inPoolTime: new Date("2026-09-01T09:00:00Z"),
      inPoolCount: 3000,
      outPoolCount: 0,
      lossCount: 20,
      status: "TEMPORARY_HOLDING",
      createdById: warehouseAdmin.id,
    },
  });

  // 7. 蟹扣领用与轧平记录
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.tagClaim.create({
    data: {
      claimDate: today,
      farmerId: farmer1.id,
      claimCount: 2000,
      boundCount: 1950,
      returnedCount: 30,
      returnReason: "规格微瑕退回重整",
      scrappedCount: 20,
      scrapReason: "打包挤压断扣",
      isBalanced: true, // 2000 == 1950 + 30 + 20
      status: "APPROVED",
      applicantId: warehouseAdmin.id,
      approverId: qaDirector.id,
      approvalComment: "核验在池存活与额度无误，予以放行",
      approvedAt: new Date(),
    },
  });

  // 8. 出库单 (发往山姆苏州邻瑞店)
  await prisma.outboundOrder.create({
    data: {
      code: "CK-20260901-001",
      batchId: batch1.id,
      storeId: sams.stores[0].id,
      channelId: sams.id,
      outboundCount: 1950,
      channelOrderCount: 1950,
      logisticsNo: "SF10882391029",
      logisticsUpdatedAt: new Date(),
      logisticsUpdatedBy: "李仓管",
      status: "APPROVED",
      applicantId: warehouseAdmin.id,
      approverId: qaDirector.id,
      approvalComment: "单票数量与在池存活校验一致，准予出库",
      approvedAt: new Date(),
    },
  });

  // 9. 盘点损耗记录
  await prisma.lossRecord.create({
    data: {
      batchId: batch1.id,
      bookInPool: 3050, // 5000 - 1950
      physicalCount: 3000,
      lossCount: 50,
      cumulativeLoss: 50,
      lossRate: 1.0, // 50 / 5000 = 1.0% <= 5%
      reason: "常规盘点运输自然损耗",
      inspectorId: warehouseAdmin.id,
    },
  });

  console.log("✅ 仿真数据种子初始化完成！");
}

main()
  .catch((e) => {
    console.error("❌ 种子数据初始化失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
