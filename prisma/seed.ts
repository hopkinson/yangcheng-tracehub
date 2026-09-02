import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 开始初始化阳澄大闸蟹溯源系统 PRD V2.1 完整基座种子数据 (固定演示日期: 2026-09-21)...");

  // 1. 清理历史数据
  await prisma.qCRecord.deleteMany();
  await prisma.specialApproval.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.lossRecord.deleteMany();
  await prisma.outboundLine.deleteMany();
  await prisma.outboundOrder.deleteMany();
  await prisma.order.deleteMany();
  await prisma.coldLog.deleteMany();
  await prisma.coldStore.deleteMany();
  await prisma.sortTask.deleteMany();
  await prisma.sortMachine.deleteMany();
  await prisma.bundleLine.deleteMany();
  await prisma.bundleBatch.deleteMany();
  await prisma.bundleGroup.deleteMany();
  await prisma.tagClaim.deleteMany();
  await prisma.batchItem.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.holdingPool.deleteMany();
  await prisma.enclosure.deleteMany();
  await prisma.farmer.deleteMany();
  await prisma.store.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.user.deleteMany();

  // 2. 用户与角色
  const admin = await prisma.user.create({
    data: {
      username: "admin",
      phone: "13800000001",
      passwordHash: "000001",
      fullName: "系统超级管理员",
      role: "ADMIN",
    },
  });
  const warehouseAdmin = await prisma.user.create({
    data: {
      username: "warehouse_mgr",
      phone: "13800000003",
      passwordHash: "000003",
      fullName: "李仓管 (库管员)",
      role: "WAREHOUSE_ADMIN",
    },
  });
  const qaDirector = await prisma.user.create({
    data: {
      username: "qa_lead",
      phone: "13800000004",
      passwordHash: "000004",
      fullName: "赵质检 (质检员)",
      role: "QA_DIRECTOR",
    },
  });
  const internalAuditor = await prisma.user.create({
    data: {
      username: "audit_mgr",
      phone: "13800000002",
      passwordHash: "000002",
      fullName: "张核验 (内部核验员)",
      role: "FARMER_ADMIN",
    },
  });

  // 3. 山姆会员店渠道与门店主档
  const sams = await prisma.channel.create({
    data: {
      code: "SAMS",
      name: "山姆会员商店 (专属配载)",
      stores: {
        create: [
          { code: "ST-01", name: "山姆会员店 (深圳福田店)" },
          { code: "ST-02", name: "山姆会员店 (深圳龙华店)" },
          { code: "ST-03", name: "山姆会员店 (广州天河店)" },
        ],
      },
    },
    include: { stores: true },
  });

  const storeMap: Record<string, string> = {};
  sams.stores.forEach((s) => {
    storeMap[s.code] = s.id;
  });

  // 4. 养殖户与围网主档
  const farmerZhang = await prisma.farmer.create({
    data: {
      code: "JD-2026-001",
      name: "张卫民",
      phone: "13812345678",
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 100.0,
      quota: 60000,
      creditRating: "A",
      status: "ACTIVE",
      contractName: "张卫民_2026阳澄湖特许养殖签约合同.pdf",
      enclosures: {
        create: [
          { code: "W-01", description: "阳澄湖东湖1号特许深水网" },
          { code: "W-02", description: "阳澄湖东湖2号生态育肥网" },
        ],
      },
    },
    include: { enclosures: true },
  });

  const farmerWang = await prisma.farmer.create({
    data: {
      code: "JD-2026-002",
      name: "王秀兰",
      phone: "13987654321",
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 50.0,
      quota: 30000,
      creditRating: "A",
      status: "ACTIVE",
      contractName: "王秀兰_2026优质供货协议.pdf",
      enclosures: {
        create: [{ code: "W-03", description: "阳澄湖中湖核心区生态围网" }],
      },
    },
    include: { enclosures: true },
  });

  const farmerZheng = await prisma.farmer.create({
    data: {
      code: "JD-2026-003",
      name: "郑向阳",
      phone: "13766668888",
      farmType: "POND_CRAB",
      year: 2026,
      area: 30.0,
      quota: 18000,
      creditRating: "B",
      status: "ACTIVE",
      contractName: "郑向阳_2026塘蟹供货协议.pdf",
      enclosures: {
        create: [{ code: "W-04", description: "西湖标准化生态养殖池" }],
      },
    },
    include: { enclosures: true },
  });

  const farmerShen = await prisma.farmer.create({
    data: {
      code: "JD-2026-004",
      name: "沈建华",
      phone: "13699990000",
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 40.0,
      quota: 24000,
      creditRating: "A",
      status: "ACTIVE",
      contractName: "沈建华_2026湖区直供合同.pdf",
      enclosures: {
        create: [{ code: "W-05", description: "阳澄湖南湖深水围网" }],
      },
    },
    include: { enclosures: true },
  });

  const farmerWu = await prisma.farmer.create({
    data: {
      code: "JD-2026-005",
      name: "吴小梅",
      phone: "13511112222",
      farmType: "POND_CRAB",
      year: 2026,
      area: 10.0,
      quota: 6000,
      creditRating: "C",
      status: "ACTIVE",
      contractName: "吴小梅_2026合作社协议.pdf",
      enclosures: {
        create: [{ code: "W-06", description: "合作社示范养殖网" }],
      },
    },
    include: { enclosures: true },
  });

  // 5. 暂养仓位 (ZY-01 ~ ZY-08, A1–C3 + 隔离观察池)
  const pool1 = await prisma.holdingPool.create({
    data: { code: "ZY-01", name: "A1 恒温暂养池 (1号)", currentGender: "MALE", currentWeightTier: "4.0两" },
  });
  const pool2 = await prisma.holdingPool.create({
    data: { code: "ZY-02", name: "A2 恒温暂养池 (2号)", currentGender: "FEMALE", currentWeightTier: "3.5两" },
  });
  const pool3 = await prisma.holdingPool.create({
    data: { code: "ZY-03", name: "A3 恒温暂养池 (3号)", currentGender: "FEMALE", currentWeightTier: "3.2两" },
  });
  const pool4 = await prisma.holdingPool.create({
    data: { code: "ZY-04", name: "B1 恒温暂养池 (4号)", currentGender: "MALE", currentWeightTier: "3.5两" },
  });
  const pool5 = await prisma.holdingPool.create({
    data: { code: "ZY-05", name: "B2 大规格公蟹池 (5号)", currentGender: "MALE", currentWeightTier: "3.5两" },
  });
  const pool6 = await prisma.holdingPool.create({
    data: { code: "ZY-06", name: "B3 精选母蟹池 (6号)", currentGender: "FEMALE", currentWeightTier: "3.0两" },
  });
  const pool7 = await prisma.holdingPool.create({
    data: { code: "ZY-07", name: "C1 特级公蟹池 (7号)", currentGender: "MALE", currentWeightTier: "4.5两" },
  });
  const pool8 = await prisma.holdingPool.create({
    data: { code: "ZY-08", name: "8号隔离观察池", currentGender: "FEMALE", currentWeightTier: "2.5两" },
  });

  // 6. 原料批次 (一码单多规格主从结构)
  // YL2026092103: 王秀兰 一张码单拆4规格入4池
  const yl03 = await prisma.batch.create({
    data: {
      code: "YL2026092103",
      farmerId: farmerWang.id,
      enclosureId: farmerWang.enclosures[0].id,
      poolId: pool1.id,
      gender: "MALE",
      weightTier: "4.0两",
      formNo: "YCGF-PZZX-202603",
      temp: 18.5,
      humidity: 85.0,
      escort: "孙师傅",
      slipName: "YCGF-PZZX-202603_入库码单原件.jpg",
      quickCheck: "QUALIFIED",
      sampleCheck: "QUALIFIED",
      status: "TEMPORARY_HOLDING",
      inPoolCount: 5000,
      createdById: warehouseAdmin.id,
      inPoolTime: new Date("2026-09-21T07:30:00Z"),
      items: {
        create: [
          { poolId: pool1.id, gender: "MALE", weightTier: "4.0两", weight: 450.0, inPoolCount: 1500 },
          { poolId: pool2.id, gender: "FEMALE", weightTier: "3.5两", weight: 380.0, inPoolCount: 1500 },
          { poolId: pool3.id, gender: "FEMALE", weightTier: "3.2两", weight: 260.0, inPoolCount: 1000 },
          { poolId: pool5.id, gender: "MALE", weightTier: "3.5两", weight: 270.0, inPoolCount: 1000 },
        ],
      },
    },
  });

  // YL2026092101: 沈建华 异常冻结批次
  const yl01 = await prisma.batch.create({
    data: {
      code: "YL2026092101",
      farmerId: farmerShen.id,
      enclosureId: farmerShen.enclosures[0].id,
      poolId: pool7.id,
      gender: "MALE",
      weightTier: "4.5两",
      formNo: "YCGF-PZZX-202618",
      temp: 20.1,
      humidity: 80.0,
      escort: "赵跟车",
      status: "FROZEN",
      isException: true,
      exceptionReason: "台账与实物数量待核查，暂停参与后续环节",
      inPoolCount: 2000,
      createdById: warehouseAdmin.id,
      inPoolTime: new Date("2026-09-21T06:40:00Z"),
      items: {
        create: [
          { poolId: pool7.id, gender: "MALE", weightTier: "4.5两", weight: 600.0, inPoolCount: 2000 },
        ],
      },
    },
  });

  // YL2026091901: 王秀兰 高损耗批次 (6.2% 超阈)
  const ylOld = await prisma.batch.create({
    data: {
      code: "YL2026091901",
      farmerId: farmerWang.id,
      enclosureId: farmerWang.enclosures[0].id,
      poolId: pool2.id,
      gender: "FEMALE",
      weightTier: "3.5两",
      formNo: "YCGF-PZZX-202620",
      status: "COMPLETED",
      inPoolCount: 3000,
      outPoolCount: 2814,
      lossCount: 186, // 186 / 3000 = 6.2%
      isException: true,
      lossReason: "高温运输装卸挤压，损耗率 6.2% 超出 5% 红线",
      createdById: warehouseAdmin.id,
      inPoolTime: new Date("2026-09-19T08:00:00Z"),
      items: {
        create: [
          { poolId: pool2.id, gender: "FEMALE", weightTier: "3.5两", weight: 800.0, inPoolCount: 3000, outPoolCount: 2814, lossCount: 186 },
        ],
      },
    },
  });

  // YL2026092001: 张卫民 部分出库批次
  await prisma.batch.create({
    data: {
      code: "YL2026092001",
      farmerId: farmerZhang.id,
      enclosureId: farmerZhang.enclosures[0].id,
      poolId: pool1.id,
      gender: "MALE",
      weightTier: "4.0两",
      formNo: "YCGF-PZZX-202604",
      temp: 18.2,
      humidity: 84.0,
      escort: "张师傅",
      status: "PARTIALLY_OUTBOUND",
      inPoolCount: 4000,
      outPoolCount: 2000,
      lossCount: 40,
      createdById: warehouseAdmin.id,
      inPoolTime: new Date("2026-09-20T07:00:00Z"),
      items: {
        create: [
          { poolId: pool1.id, gender: "MALE", weightTier: "4.0两", weight: 1200.0, inPoolCount: 4000, outPoolCount: 2000, lossCount: 40 },
        ],
      },
    },
  });

  // YL2026092002: 张卫民 暂养中批次
  await prisma.batch.create({
    data: {
      code: "YL2026092002",
      farmerId: farmerZhang.id,
      enclosureId: farmerZhang.enclosures[1].id,
      poolId: pool4.id,
      gender: "MALE",
      weightTier: "3.5两",
      formNo: "YCGF-PZZX-202605",
      temp: 18.0,
      humidity: 86.0,
      escort: "李师傅",
      status: "TEMPORARY_HOLDING",
      inPoolCount: 6000,
      createdById: warehouseAdmin.id,
      inPoolTime: new Date("2026-09-20T08:30:00Z"),
      items: {
        create: [
          { poolId: pool4.id, gender: "MALE", weightTier: "3.5两", weight: 1600.0, inPoolCount: 6000 },
        ],
      },
    },
  });

  // YL2026092102: 郑向阳 暂养中批次
  await prisma.batch.create({
    data: {
      code: "YL2026092102",
      farmerId: farmerZheng.id,
      enclosureId: farmerZheng.enclosures[0].id,
      poolId: pool6.id,
      gender: "FEMALE",
      weightTier: "3.0两",
      formNo: "YCGF-PZZX-202606",
      temp: 18.8,
      humidity: 83.0,
      escort: "周师傅",
      status: "TEMPORARY_HOLDING",
      inPoolCount: 3000,
      createdById: warehouseAdmin.id,
      inPoolTime: new Date("2026-09-21T06:10:00Z"),
      items: {
        create: [
          { poolId: pool6.id, gender: "FEMALE", weightTier: "3.0两", weight: 750.0, inPoolCount: 3000 },
        ],
      },
    },
  });

  // YL2026092003: 郑向阳 暂养中批次
  await prisma.batch.create({
    data: {
      code: "YL2026092003",
      farmerId: farmerZheng.id,
      enclosureId: farmerZheng.enclosures[0].id,
      poolId: pool5.id,
      gender: "MALE",
      weightTier: "3.5两",
      formNo: "YCGF-PZZX-202607",
      temp: 18.5,
      humidity: 85.0,
      escort: "孙师傅",
      status: "TEMPORARY_HOLDING",
      inPoolCount: 2500,
      createdById: warehouseAdmin.id,
      inPoolTime: new Date("2026-09-20T09:00:00Z"),
      items: {
        create: [
          { poolId: pool5.id, gender: "MALE", weightTier: "3.5两", weight: 680.0, inPoolCount: 2500 },
        ],
      },
    },
  });

  // YL2026091801: 吴小梅 历史已出清批次
  await prisma.batch.create({
    data: {
      code: "YL2026091801",
      farmerId: farmerWu.id,
      enclosureId: farmerWu.enclosures[0].id,
      poolId: pool8.id,
      gender: "FEMALE",
      weightTier: "2.5两",
      formNo: "YCGF-PZZX-202608",
      temp: 19.0,
      humidity: 82.0,
      escort: "赵师傅",
      status: "COMPLETED",
      inPoolCount: 2000,
      outPoolCount: 1950,
      lossCount: 50,
      lossReason: "常规分拣损耗 (2.5%)",
      createdById: warehouseAdmin.id,
      inPoolTime: new Date("2026-09-18T08:00:00Z"),
      items: {
        create: [
          { poolId: pool8.id, gender: "FEMALE", weightTier: "2.5两", weight: 420.0, inPoolCount: 2000, outPoolCount: 1950, lossCount: 50 },
        ],
      },
    },
  });

  // YL2026092104: 沈建华 双规格到货批次
  await prisma.batch.create({
    data: {
      code: "YL2026092104",
      farmerId: farmerShen.id,
      enclosureId: farmerShen.enclosures[0].id,
      poolId: pool1.id,
      gender: "MALE",
      weightTier: "4.0两",
      formNo: "YCGF-PZZX-202609",
      temp: 18.6,
      humidity: 84.5,
      escort: "王跟车",
      status: "TEMPORARY_HOLDING",
      inPoolCount: 3500,
      createdById: warehouseAdmin.id,
      inPoolTime: new Date("2026-09-21T08:45:00Z"),
      items: {
        create: [
          { poolId: pool1.id, gender: "MALE", weightTier: "4.0两", weight: 600.0, inPoolCount: 2000 },
          { poolId: pool4.id, gender: "MALE", weightTier: "3.5两", weight: 400.0, inPoolCount: 1500 },
        ],
      },
    },
  });

  // 7. 蟹扣申领 (XK)
  const xk01 = await prisma.tagClaim.create({
    data: {
      code: "XK2026092001",
      claimDate: new Date("2026-09-20T08:00:00Z"),
      farmerId: farmerZhang.id,
      claimCount: 600,
      boundCount: 445,
      returnedCount: 100,
      scrappedCount: 55,
      isBalanced: true,
      status: "APPROVED",
      applicantId: warehouseAdmin.id,
      approverId: internalAuditor.id,
      approvalComment: "存活余量与额度符合硬约束，准予领用",
      approvedAt: new Date("2026-09-20T08:30:00Z"),
    },
  });

  const xk02 = await prisma.tagClaim.create({
    data: {
      code: "XK2026092101",
      claimDate: new Date("2026-09-21T07:40:00Z"),
      farmerId: farmerWang.id,
      claimCount: 1500,
      boundCount: 1240,
      returnedCount: 200,
      scrappedCount: 60,
      isBalanced: true,
      status: "APPROVED",
      applicantId: warehouseAdmin.id,
      approverId: internalAuditor.id,
      approvalComment: "核验无误，予以发放",
      approvedAt: new Date("2026-09-21T08:00:00Z"),
    },
  });

  const xk03 = await prisma.tagClaim.create({
    data: {
      code: "XK2026092102",
      claimDate: new Date("2026-09-21T08:10:00Z"),
      farmerId: farmerZheng.id,
      claimCount: 800,
      status: "PENDING",
      applicantId: warehouseAdmin.id,
    },
  });

  const xk04 = await prisma.tagClaim.create({
    data: {
      code: "XK2026092103",
      claimDate: new Date("2026-09-21T08:20:00Z"),
      farmerId: farmerWang.id,
      claimCount: 1200,
      status: "APPROVED",
      applicantId: warehouseAdmin.id,
      approverId: internalAuditor.id,
      approvalComment: "核对王秀兰在池活蟹充足，准予领扣1200只",
      approvedAt: new Date("2026-09-21T08:25:00Z"),
    },
  });

  const xk05 = await prisma.tagClaim.create({
    data: {
      code: "XK2026092104",
      claimDate: new Date("2026-09-21T08:30:00Z"),
      farmerId: farmerWu.id,
      claimCount: 500,
      status: "REJECTED",
      applicantId: warehouseAdmin.id,
      approverId: internalAuditor.id,
      approvalComment: "该户本年度额度已用尽（使用率100%），触发风控硬拦截",
      approvedAt: new Date("2026-09-21T08:35:00Z"),
    },
  });

  // 8. 捆扎班组与捆扎批次 (P & KZD)
  const group1 = await prisma.bundleGroup.create({
    data: { code: "P1", name: "捆扎一组", status: "COMPLETED" },
  });
  const group2 = await prisma.bundleGroup.create({
    data: { code: "P2", name: "捆扎二组", status: "COMPLETED" },
  });
  const group3 = await prisma.bundleGroup.create({
    data: { code: "P3", name: "捆扎三组", status: "BUNDLING" },
  });

  const kzd01 = await prisma.bundleBatch.create({
    data: {
      code: "KZD2026092101",
      groupId: group1.id,
      tagClaimId: xk01.id,
      ropeBatch: "XS2026090101",
      status: "COMPLETED",
      date: new Date("2026-09-21T08:00:00Z"),
      doneAt: new Date("2026-09-21T09:00:00Z"),
      lines: {
        create: [{ poolId: pool1.id, gender: "MALE", weightTier: "4.0两", count: 445 }],
      },
    },
  });

  const kzd02 = await prisma.bundleBatch.create({
    data: {
      code: "KZD2026092102",
      groupId: group2.id,
      tagClaimId: xk04.id, // XK2026092103
      ropeBatch: "XS2026090101",
      status: "COMPLETED",
      date: new Date("2026-09-21T08:30:00Z"),
      doneAt: new Date("2026-09-21T09:40:00Z"),
      lines: {
        create: [{ poolId: pool3.id, gender: "FEMALE", weightTier: "3.2两", count: 1240 }],
      },
    },
  });

  // KZD2026092103: 捆扎中 (演示未完成不能分拣)
  const kzd03 = await prisma.bundleBatch.create({
    data: {
      code: "KZD2026092103",
      groupId: group3.id,
      tagClaimId: xk02.id,
      ropeBatch: "XS2026090102",
      status: "BUNDLING",
      date: new Date("2026-09-21T09:00:00Z"),
      lines: {
        create: [
          { poolId: pool5.id, gender: "MALE", weightTier: "3.5两", count: 2475 },
          { poolId: pool6.id, gender: "FEMALE", weightTier: "3.0两", count: 780 },
        ],
      },
    },
  });

  // 09-20 历史批次
  const kzdHist1 = await prisma.bundleBatch.create({
    data: {
      code: "KZD2026092001",
      groupId: group1.id,
      tagClaimId: xk01.id,
      ropeBatch: "XS2026090101",
      status: "COMPLETED",
      date: new Date("2026-09-20T08:00:00Z"),
      doneAt: new Date("2026-09-20T09:30:00Z"),
      lines: {
        create: [{ poolId: pool2.id, gender: "FEMALE", weightTier: "3.5两", count: 1200 }],
      },
    },
  });

  const kzdHist2 = await prisma.bundleBatch.create({
    data: {
      code: "KZD2026092002",
      groupId: group2.id,
      tagClaimId: xk02.id,
      ropeBatch: "XS2026090101",
      status: "COMPLETED",
      date: new Date("2026-09-20T09:00:00Z"),
      doneAt: new Date("2026-09-20T10:20:00Z"),
      lines: {
        create: [{ poolId: pool3.id, gender: "FEMALE", weightTier: "3.2两", count: 1000 }],
      },
    },
  });

  // 9. 分拣机器与分拣任务 (FJ & FJR)
  const machine1 = await prisma.sortMachine.create({
    data: {
      code: "FJ-01",
      name: "高速动态分拣机 G1",
      status: "ACTIVE",
      lastCalibratedAt: new Date("2026-09-21T06:35:00Z"),
      lastCalibrationStatus: "QUALIFIED",
    },
  });

  const machine2 = await prisma.sortMachine.create({
    data: {
      code: "FJ-02",
      name: "多通道分拣机 M1",
      status: "ACTIVE",
      lastCalibratedAt: new Date("2026-09-21T06:45:00Z"),
      lastCalibrationStatus: "QUALIFIED",
    },
  });

  const fjr01 = await prisma.sortTask.create({
    data: {
      code: "FJR2026092101",
      machineId: machine1.id,
      bundleBatchId: kzd01.id,
      gender: "MALE",
      weightTier: "4.0两",
      inputCount: 445,
      qualifiedCount: 438,
      lossCount: 7,
      lossRate: 1.57,
      status: "COMPLETED",
      date: new Date("2026-09-21T09:10:00Z"),
      doneAt: new Date("2026-09-21T09:40:00Z"),
    },
  });

  const fjr02 = await prisma.sortTask.create({
    data: {
      code: "FJR2026092102",
      machineId: machine2.id,
      bundleBatchId: kzd02.id,
      gender: "FEMALE",
      weightTier: "3.2两",
      inputCount: 1200,
      status: "PENDING",
      date: new Date("2026-09-21T09:50:00Z"),
    },
  });

  // 历史分拣任务 (提供冷库库存)
  const fjrHist1 = await prisma.sortTask.create({
    data: {
      code: "FJR2026092001",
      machineId: machine1.id,
      bundleBatchId: kzdHist1.id,
      gender: "FEMALE",
      weightTier: "3.5两",
      inputCount: 1200,
      qualifiedCount: 1180,
      lossCount: 20,
      lossRate: 1.67,
      status: "COMPLETED",
      date: new Date("2026-09-20T10:00:00Z"),
      doneAt: new Date("2026-09-20T10:30:00Z"),
    },
  });

  const fjrHist2 = await prisma.sortTask.create({
    data: {
      code: "FJR2026092002",
      machineId: machine2.id,
      bundleBatchId: kzdHist2.id,
      gender: "FEMALE",
      weightTier: "3.2两",
      inputCount: 1000,
      qualifiedCount: 985,
      lossCount: 15,
      lossRate: 1.5,
      status: "COMPLETED",
      date: new Date("2026-09-20T11:00:00Z"),
      doneAt: new Date("2026-09-20T11:35:00Z"),
    },
  });

  // 10. 保鲜预冷 (BX & CR)
  const bx01 = await prisma.coldStore.create({
    data: { code: "BX-01", name: "保鲜预冷A区", targetTemp: 4.2 },
  });
  const bx02 = await prisma.coldStore.create({
    data: { code: "BX-02", name: "保鲜预冷B区", targetTemp: 4.5 },
  });
  const bx03 = await prisma.coldStore.create({
    data: { code: "BX-03", name: "保鲜预冷C区", targetTemp: 4.0 },
  });

  await prisma.coldLog.createMany({
    data: [
      { code: "CR-0901", storeId: bx01.id, type: "INTAKE", count: 600, refType: "BUNDLE", refId: "KZD2026092101", operator: "李仓管" },
      { code: "CR-0902", storeId: bx02.id, type: "INTAKE", count: 1200, refType: "BUNDLE", refId: "KZD2026092102", operator: "李仓管" },
      { code: "CR-0903", storeId: bx02.id, type: "INTAKE", count: 1180, refType: "SORT", refId: "FJR2026092001", operator: "李仓管" },
      { code: "CR-0904", storeId: bx03.id, type: "INTAKE", count: 985, refType: "SORT", refId: "FJR2026092002", operator: "李仓管" },
    ],
  });

  // 11. 订单管理 (SO)
  const order1 = await prisma.order.create({
    data: {
      code: "SO2026092101",
      importId: "IM2026092001",
      orderNo: "SM20260920001",
      type: "STORE_ORDER",
      storeId: storeMap["ST-01"],
      storeName: "山姆会员店 (深圳福田店)",
      gender: "MALE",
      weightTier: "4.0两",
      count: 400,
      deliveryDate: new Date("2026-09-21"),
      status: "SHIPPED",
    },
  });

  const order2 = await prisma.order.create({
    data: {
      code: "SO2026092102",
      importId: "IM2026092002",
      orderNo: "KK20260920055",
      type: "CRAB_CARD",
      specModel: "3.5母蟹X600只",
      gender: "FEMALE",
      weightTier: "3.5两",
      count: 600,
      deliveryDate: new Date("2026-09-21"),
      status: "PENDING",
    },
  });

  // 09-22 待发货需求
  await prisma.order.createMany({
    data: [
      { code: "SO2026092103", importId: "IM2026092101", orderNo: "SM20260921008", type: "STORE_ORDER", storeId: storeMap["ST-02"], storeName: "山姆会员店 (深圳龙华店)", gender: "MALE", weightTier: "4.0两", count: 1500, deliveryDate: new Date("2026-09-22"), status: "PENDING" },
      { code: "SO2026092104", importId: "IM2026092101", orderNo: "SM20260921012", type: "STORE_ORDER", storeId: storeMap["ST-03"], storeName: "山姆会员店 (广州天河店)", gender: "FEMALE", weightTier: "3.2两", count: 1200, deliveryDate: new Date("2026-09-22"), status: "PENDING" },
      { code: "SO2026092105", importId: "IM2026092102", orderNo: "KK20260921088", type: "CRAB_CARD", specModel: "3.5公蟹X800只", gender: "MALE", weightTier: "3.5两", count: 800, deliveryDate: new Date("2026-09-22"), status: "PENDING" },
      { code: "SO2026092106", importId: "IM2026092102", orderNo: "KK20260921102", type: "CRAB_CARD", specModel: "4.0母蟹X5只，5.0公蟹X5只", gender: "FEMALE", weightTier: "4.0两", count: 5, deliveryDate: new Date("2026-09-22"), status: "PENDING" },
      { code: "SO2026092107", importId: "IM2026092102", orderNo: "KK20260921102", type: "CRAB_CARD", specModel: "4.0母蟹X5只，5.0公蟹X5只", gender: "MALE", weightTier: "5.0两", count: 5, deliveryDate: new Date("2026-09-22"), status: "PENDING" },
    ],
  });

  // 12. 出库单 (CK & 出库明细)
  // CK2026092101: 门店订单 已出库
  await prisma.outboundOrder.create({
    data: {
      code: "CK2026092101",
      batchId: yl03.id,
      type: "STORE_ORDER",
      storeId: storeMap["ST-01"],
      storeName: "山姆会员店 (深圳福田店)",
      channelId: sams.id,
      outboundCount: 400,
      channelOrderCount: 400,
      logisticsNo: "门店冷链专车自配",
      status: "APPROVED",
      applicantId: warehouseAdmin.id,
      approverId: internalAuditor.id,
      approvalComment: "冷库分拣库存核定充足，准予出库发往福田店",
      approvedAt: new Date("2026-09-21T10:00:00Z"),
      lines: {
        create: [
          { orderId: order1.id, orderNo: order1.orderNo, gender: "MALE", weightTier: "4.0两", count: 400 },
        ],
      },
    },
  });

  // CK2026092102: 提蟹订单 待审核
  await prisma.outboundOrder.create({
    data: {
      code: "CK2026092102",
      batchId: yl03.id,
      type: "CRAB_CARD",
      storeId: storeMap["ST-01"],
      storeName: "蟹卡提货 (顺丰全国直发)",
      channelId: sams.id,
      outboundCount: 600,
      channelOrderCount: 600,
      status: "PENDING",
      applicantId: warehouseAdmin.id,
      lines: {
        create: [
          { orderId: order2.id, orderNo: order2.orderNo, gender: "FEMALE", weightTier: "3.5两", count: 600 },
        ],
      },
    },
  });

  // CK2026092002: 门店订单 天河店 已出库
  await prisma.outboundOrder.create({
    data: {
      code: "CK2026092002",
      batchId: ylOld.id,
      type: "STORE_ORDER",
      storeId: storeMap["ST-03"],
      storeName: "山姆会员店 (广州天河店)",
      channelId: sams.id,
      outboundCount: 900,
      channelOrderCount: 900,
      logisticsNo: "门店冷链专车自配",
      status: "APPROVED",
      applicantId: warehouseAdmin.id,
      approverId: internalAuditor.id,
      approvalComment: "冷库分拣库存充足，准予出库发往天河店",
      approvedAt: new Date("2026-09-20T16:00:00Z"),
      lines: {
        create: [
          { orderNo: "SM20260920002", gender: "FEMALE", weightTier: "3.2两", count: 900 },
        ],
      },
    },
  });

  // 历史出库单 CK2026092001 (物流已齐，供追溯演示)
  await prisma.outboundOrder.create({
    data: {
      code: "CK2026092001",
      batchId: ylOld.id,
      type: "CRAB_CARD",
      storeId: storeMap["ST-01"],
      storeName: "蟹卡提货 (顺丰速运直发)",
      channelId: sams.id,
      outboundCount: 500,
      channelOrderCount: 500,
      logisticsNo: "顺丰冷链 (SF10982310891 等2单)",
      status: "APPROVED",
      applicantId: warehouseAdmin.id,
      approverId: internalAuditor.id,
      approvedAt: new Date("2026-09-20T14:30:00Z"),
      lines: {
        create: [
          { orderNo: "KK20260919018", gender: "FEMALE", weightTier: "3.5两", count: 300, expressCompany: "顺丰冷链", waybillNo: "SF10982310891" },
          { orderNo: "KK20260919026", gender: "FEMALE", weightTier: "3.5两", count: 200, expressCompany: "顺丰冷链", waybillNo: "SF10982310892" },
        ],
      },
    },
  });

  // 13. 12 类品控留痕记录 (QCRecord)
  await prisma.qCRecord.createMany({
    data: [
      {
        code: "BZ2026092101",
        cat: "PACK_INSPECT",
        formNo: "YCGF-PZZX-202610",
        refType: "OUTBOUND",
        refId: "CK2026092101",
        title: "大闸蟹礼盒包装与封签巡检记录表 (CK2026092101)",
        checkTime: new Date("2026-09-21T09:30:00Z"),
        uploadTime: new Date("2026-09-21T09:45:00Z"),
        result: "QUALIFIED",
        conclusion: "内衬冰袋完好，封签完整，扣带防伪齿无松脱",
        uploader: "赵质检",
        fileName: "BZ2026092101_包装巡检表.jpg",
      },
      {
        code: "CL2026092101",
        cat: "VEHICLE_INSPECT",
        formNo: "YCGF-PZZX-202611",
        refType: "OUTBOUND",
        refId: "CK2026092101",
        title: "冷链运输车辆出车前车况与温度检查表 (苏E·88888)",
        checkTime: new Date("2026-09-21T09:40:00Z"),
        uploadTime: new Date("2026-09-21T09:55:00Z"),
        result: "QUALIFIED",
        conclusion: "车厢预冷至 4.0℃，制冷机组运转正常，消杀记录完备",
        uploader: "赵质检",
        fileName: "CL2026092101_冷链车检查表.jpg",
      },
      {
        code: "BZ2026092001",
        cat: "PACK_INSPECT",
        formNo: "YCGF-PZZX-202610",
        refType: "OUTBOUND",
        refId: "CK2026092001",
        title: "大闸蟹礼盒包装与顺丰温控贴抽检表 (CK2026092001)",
        checkTime: new Date("2026-09-20T14:00:00Z"),
        uploadTime: new Date("2026-09-20T14:20:00Z"),
        result: "QUALIFIED",
        conclusion: "泡沫箱密封完好，温控变色贴正常，顺丰面单清晰",
        uploader: "赵质检",
        fileName: "BZ2026092001_顺丰直发包装抽检.jpg",
      },
      {
        code: "CL2026092001",
        cat: "VEHICLE_INSPECT",
        formNo: "YCGF-PZZX-202611",
        refType: "OUTBOUND",
        refId: "CK2026092002",
        title: "冷链运输车辆出车前车况与温度检查表 (天河店冷链车)",
        checkTime: new Date("2026-09-20T15:30:00Z"),
        uploadTime: new Date("2026-09-20T15:50:00Z"),
        result: "QUALIFIED",
        conclusion: "车况良好，冷柜设定温度 4.2℃",
        uploader: "赵质检",
        fileName: "CL2026092001_天河冷链车检查表.jpg",
      },
      {
        code: "JC2026092101",
        cat: "QUICK_CHECK",
        formNo: "YCGF-PZZX-202601",
        refType: "BATCH",
        refId: "YL2026092103",
        title: "兽药农残专项快速检测表",
        checkTime: new Date("2026-09-21T07:15:00Z"),
        uploadTime: new Date("2026-09-21T07:40:00Z"),
        result: "QUALIFIED",
        conclusion: "全部指标符合产地无公害水产标准，未检出违禁药物",
        uploader: "赵质检",
        fileName: "JC2026092101_农残快检合格原件.jpg",
      },
      {
        code: "SC2026092101",
        cat: "TASTE_CHECK",
        formNo: "YCGF-PZZX-202602",
        refType: "BATCH",
        refId: "YL2026092103",
        title: "大闸蟹品质抽检与熟化试吃记录",
        checkTime: new Date("2026-09-21T07:25:00Z"),
        uploadTime: new Date("2026-09-21T07:45:00Z"),
        result: "QUALIFIED",
        conclusion: "蟹黄饱满，肉质紧实甘甜，无异味",
        uploader: "赵质检",
        fileName: "SC2026092101_试吃品评记录.jpg",
      },
      {
        code: "SZ2026092101",
        cat: "WATER_QUALITY",
        formNo: "YCGF-PZZX-202605",
        refType: "POOL",
        refId: "ZY-06",
        title: "暂养水质监测记录表 (6号精选母蟹池)",
        checkTime: new Date("2026-09-21T08:00:00Z"),
        uploadTime: new Date("2026-09-21T08:20:00Z"),
        result: "EXCEPTION",
        conclusion: "氨氮 0.28mg/L 超过警戒线 (<=0.20mg/L)",
        reason: "池水循环过滤器杂质沉淀，已启动应急换水与增氧机复检",
        uploader: "赵质检",
        fileName: "SZ2026092101_水质监测异常表.jpg",
      },
      {
        code: "XJ2026092101",
        cat: "POOL_INSPECT",
        formNo: "YCGF-PZZX-202604",
        refType: "POOL",
        refId: "ZY-01",
        title: "大闸蟹暂养巡检记录表 (1号恒温池 A1)",
        checkTime: new Date("2026-09-21T08:30:00Z"),
        uploadTime: new Date("2026-09-21T08:50:00Z"),
        result: "QUALIFIED",
        conclusion: "全部项目合格，暂养环境正常",
        uploader: "赵质检",
        fileName: "XJ2026092101_暂养巡检表.jpg",
      },
      {
        code: "XJ2026092001",
        cat: "POOL_INSPECT",
        formNo: "YCGF-PZZX-202604",
        refType: "POOL",
        refId: "ZY-01",
        title: "大闸蟹暂养巡检记录表 (1号恒温池 A1 - 历史记录)",
        checkTime: new Date("2026-09-20T16:00:00Z"),
        uploadTime: new Date("2026-09-20T17:15:00Z"),
        result: "QUALIFIED",
        conclusion: "存在轻微异常，已整改，可正常暂养",
        reason: "微孔增氧管局部出气不均，已调整气阀并完成复核",
        uploader: "赵质检",
        fileName: "XJ2026092001_暂养巡检整改表.jpg",
      },
      {
        code: "KZ2026092101",
        cat: "BUNDLE_INSPECT",
        formNo: "YCGF-PZZX-202606",
        refType: "WORKSHOP",
        refId: "BZ-WORKSHOP",
        title: "车间捆扎现场作业与绑扣规范巡检记录表",
        checkTime: new Date("2026-09-21T08:15:00Z"),
        uploadTime: new Date("2026-09-21T08:45:00Z"),
        result: "QUALIFIED",
        conclusion: "全部合格，正常作业放行",
        uploader: "赵质检",
        fileName: "KZ2026092101_捆扎规范巡检表.jpg",
      },
      {
        code: "KZ2026092001",
        cat: "BUNDLE_INSPECT",
        formNo: "YCGF-PZZX-202606",
        refType: "WORKSHOP",
        refId: "BZ-WORKSHOP",
        title: "车间捆扎现场作业与绑扣规范巡检记录表 (历史记录)",
        checkTime: new Date("2026-09-20T14:30:00Z"),
        uploadTime: new Date("2026-09-20T16:00:00Z"), // 暴露后填补录 gap
        result: "EXCEPTION",
        conclusion: "存在问题，暂停整改",
        reason: "P3 组工位个别蟹扣防伪齿未卡紧，已责令返工重扎并复验合格",
        uploader: "赵质检",
        fileName: "KZ2026092001_捆扎巡检整改表.jpg",
      },
      {
        code: "JZ2026092101",
        cat: "SORT_CALIBRATE",
        formNo: "YCGF-PZZX-202607",
        refType: "MACHINE",
        refId: "FJ-01",
        title: "分拣设备精度校验记录表 (FJ-01 高速动态分拣机)",
        checkTime: new Date("2026-09-21T06:35:00Z"),
        uploadTime: new Date("2026-09-21T06:50:00Z"),
        result: "QUALIFIED",
        conclusion: "50g/150g/200g 标准砝码校验误差均 <= +-1.5g，准予开机",
        uploader: "赵质检",
        fileName: "JZ2026092101_分拣校验记录表.jpg",
      },
      {
        code: "FJ2026092001",
        cat: "SORT_INSPECT",
        formNo: "YCGF-PZZX-202608",
        refType: "MACHINE",
        refId: "FJ-02",
        title: "机器分拣作业巡检记录表 (FJ-02)",
        checkTime: new Date("2026-09-20T15:00:00Z"),
        uploadTime: new Date("2026-09-20T16:30:00Z"), // 暴露后填补录 gap
        result: "QUALIFIED",
        conclusion: "存在问题，已完成整改闭环",
        reason: "传送带导轨有残余蟹绳卡滞，已停机清理并完成复检",
        uploader: "赵质检",
        fileName: "FJ2026092001_分拣巡检表.jpg",
      },
      {
        code: "BX2026092101",
        cat: "COLD_TEMP",
        formNo: "YCGF-PZZX-202609",
        refType: "STORE",
        refId: "BX-01",
        title: "保鲜库温湿度监控记录表 (BX-01 预冷A区)",
        checkTime: new Date("2026-09-21T09:00:00Z"),
        uploadTime: new Date("2026-09-21T09:15:00Z"),
        result: "QUALIFIED",
        conclusion: "温度 4.2℃，湿度 65%，冷风循环正常",
        uploader: "赵质检",
        fileName: "BX2026092101_预冷温湿度表.jpg",
      },
      {
        code: "BX2026092102",
        cat: "COLD_TEMP",
        formNo: "YCGF-PZZX-202609",
        refType: "STORE",
        refId: "BX-02",
        title: "保鲜库温湿度监控记录表 (BX-02 预冷B区)",
        checkTime: new Date("2026-09-21T09:05:00Z"),
        uploadTime: new Date("2026-09-21T09:20:00Z"),
        result: "QUALIFIED",
        conclusion: "温度 4.5℃，湿度 68%，控温稳定",
        uploader: "赵质检",
        fileName: "BX2026092102_预冷温湿度表.jpg",
      },
      {
        code: "BX2026092103",
        cat: "COLD_TEMP",
        formNo: "YCGF-PZZX-202609",
        refType: "STORE",
        refId: "BX-03",
        title: "保鲜库温湿度监控记录表 (BX-03 预冷C区)",
        checkTime: new Date("2026-09-21T09:10:00Z"),
        uploadTime: new Date("2026-09-21T09:25:00Z"),
        result: "QUALIFIED",
        conclusion: "温度 4.0℃，湿度 62%，运行良好",
        uploader: "赵质检",
        fileName: "BX2026092103_预冷温湿度表.jpg",
      },
    ],
  });

  console.log("🎉 PRD V2.1 仿真种子数据初始化 100% 完成！");
}

main()
  .catch((e) => {
    console.error("❌ 种子数据初始化失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
