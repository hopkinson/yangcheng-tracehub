import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createQCRecordAction, deleteQCRecordAction } from "../src/actions/qc";
import { createSortTasksAction } from "../src/actions/production";

const prisma = new PrismaClient();

async function runOutboundQcTest() {
  console.log("================================================================================");
  console.log("🦀 出库品控巡检与分拣批量开机改动验证测试 (Outbound QC & Sorting Tasks Test)");
  console.log("================================================================================\n");

  const timestamp = Date.now();
  const testRefId = `CK-TEST-${timestamp}`;

  const createdQcIds: string[] = [];
  const createdSortTaskIds: string[] = [];
  let testMachineId = "";
  let testBundleBatchId = "";
  let testBundleGroupId = "";
  let testTagClaimId = "";
  let testFarmerId = "";
  let testPoolId = "";

  try {
    // -------------------------------------------------------------------------
    // 1. 验证出库包装巡检 (PACK_INSPECT) 登记逻辑
    // -------------------------------------------------------------------------
    console.log("▶ [Test 1] 验证出库包装巡检 (PACK_INSPECT) 记录创建与单号前缀 (BZ)");
    const packRes = await createQCRecordAction({
      cat: "PACK_INSPECT",
      formNo: "YCGF-PZZX-202610",
      refType: "OUTBOUND",
      refId: testRefId,
      title: "大闸蟹礼盒包装与封签巡检记录表 (自动化测试)",
      checkTime: new Date().toISOString(),
      conclusion: "内衬冰袋完好，封签完整，扣带防伪齿无松脱",
      uploader: "赵质检",
    });

    assert.equal(packRes.success, true, `包装巡检创建失败: ${packRes.message}`);
    assert.ok(packRes.code?.startsWith("BZ"), `包装巡检单号前缀必须为 BZ，当前为: ${packRes.code}`);

    const packRecord = await prisma.qCRecord.findFirst({
      where: { code: packRes.code },
    });
    assert.ok(packRecord, "数据库中未找到新创建的包装巡检记录");
    assert.equal(packRecord.cat, "PACK_INSPECT");
    assert.equal(packRecord.refId, testRefId);
    assert.equal(packRecord.result, "QUALIFIED");
    createdQcIds.push(packRecord.id);
    console.log(`  ✔ 包装巡检记录创建成功: 单号=${packRecord.code}, 关联出库单=${packRecord.refId}, 判定=${packRecord.result}`);

    // -------------------------------------------------------------------------
    // 2. 验证出库冷链车辆检查 (VEHICLE_INSPECT) 登记逻辑
    // -------------------------------------------------------------------------
    console.log("\n▶ [Test 2] 验证冷链车辆检查 (VEHICLE_INSPECT) 记录创建与单号前缀 (CL)");
    const vehicleRes = await createQCRecordAction({
      cat: "VEHICLE_INSPECT",
      formNo: "YCGF-PZZX-202611",
      refType: "OUTBOUND",
      refId: testRefId,
      title: "冷链运输车辆出车前车况与温度检查表 (自动化测试)",
      checkTime: new Date().toISOString(),
      conclusion: "车厢预冷至 4.0℃，制冷机组运转正常，消杀记录完备",
      uploader: "赵质检",
    });

    assert.equal(vehicleRes.success, true, `车辆检查创建失败: ${vehicleRes.message}`);
    assert.ok(vehicleRes.code?.startsWith("CL"), `车辆检查单号前缀必须为 CL，当前为: ${vehicleRes.code}`);

    const vehicleRecord = await prisma.qCRecord.findFirst({
      where: { code: vehicleRes.code },
    });
    assert.ok(vehicleRecord, "数据库中未找到新创建的车辆检查记录");
    assert.equal(vehicleRecord.cat, "VEHICLE_INSPECT");
    assert.equal(vehicleRecord.refId, testRefId);
    assert.equal(vehicleRecord.result, "QUALIFIED");
    createdQcIds.push(vehicleRecord.id);
    console.log(`  ✔ 车辆检查记录创建成功: 单号=${vehicleRecord.code}, 关联出库单=${vehicleRecord.refId}, 判定=${vehicleRecord.result}`);

    // -------------------------------------------------------------------------
    // 3. 验证出库管理页面数据查询联动 (where.cat in ['PACK_INSPECT', 'VEHICLE_INSPECT', 'SHIP_LOG'])
    // -------------------------------------------------------------------------
    console.log("\n▶ [Test 3] 验证出库管理页面的品控查询条件完整召回相关记录");
    const outboundQcList = await prisma.qCRecord.findMany({
      where: {
        cat: { in: ["PACK_INSPECT", "VEHICLE_INSPECT", "SHIP_LOG"] },
        refId: testRefId,
      },
      orderBy: { checkTime: "desc" },
    });

    assert.equal(outboundQcList.length, 2, `出库品控查询未能完全召回测试记录，实际数量: ${outboundQcList.length}`);
    const cats = outboundQcList.map((r) => r.cat);
    assert.ok(cats.includes("PACK_INSPECT"), "查询结果缺少 PACK_INSPECT");
    assert.ok(cats.includes("VEHICLE_INSPECT"), "查询结果缺少 VEHICLE_INSPECT");
    console.log(`  ✔ 出库品控台账查询成功匹配到 ${outboundQcList.length} 条记录 (PACK_INSPECT + VEHICLE_INSPECT)`);

    // -------------------------------------------------------------------------
    // 4. 验证分拣批量创建任务 (createSortTasksAction)
    // -------------------------------------------------------------------------
    console.log("\n▶ [Test 4] 验证分拣多规格明细批量创建 (createSortTasksAction)");
    // 准备分拣测试环境
    const machine = await prisma.sortMachine.create({
      data: {
        code: `FJ-TEST-${timestamp}`,
        name: "测试分拣机",
        status: "ACTIVE",
      },
    });
    testMachineId = machine.id;

    const farmer = await prisma.farmer.create({
      data: {
        code: `JD-TEST-${timestamp}`,
        name: "分拣测试养殖户",
        phone: `139${String(timestamp).slice(-8)}`,
        farmType: "LAKE_CRAB",
        year: 2026,
        area: 50,
        quota: 30000,
        status: "ACTIVE",
      },
    });
    testFarmerId = farmer.id;

    const pool = await prisma.holdingPool.create({
      data: {
        code: `ZY-TEST-${timestamp}`,
        name: "测试暂养池",
        status: "ACTIVE",
      },
    });
    testPoolId = pool.id;

    const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });

    const tagClaim = await prisma.tagClaim.create({
      data: {
        code: `TC-TEST-${timestamp}`,
        farmerId: farmer.id,
        claimCount: 500,
        claimDate: new Date(),
        applicantId: adminUser?.id || "admin",
        status: "APPROVED",
      },
    });
    testTagClaimId = tagClaim.id;

    const bundleGroup = await prisma.bundleGroup.create({
      data: {
        code: `BG-TEST-${timestamp}`,
        name: "测试捆扎组",
      },
    });
    testBundleGroupId = bundleGroup.id;

    const bundleBatch = await prisma.bundleBatch.create({
      data: {
        code: `BB-TEST-${timestamp}`,
        groupId: bundleGroup.id,
        tagClaimId: tagClaim.id,
        ropeBatch: "XS-TEST",
        status: "COMPLETED",
        inputCount: 300,
        lines: {
          create: [
            { poolId: pool.id, gender: "MALE", weightTier: "4.0两", count: 150 },
            { poolId: pool.id, gender: "FEMALE", weightTier: "3.5两", count: 150 },
          ],
        },
      },
      include: { lines: true },
    });
    testBundleBatchId = bundleBatch.id;

    // 执行批量创建分拣任务
    const sortRes = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: bundleBatch.id,
      items: [
        { gender: "MALE", weightTier: "4.0两", inputCount: 100 },
        { gender: "FEMALE", weightTier: "3.5两", inputCount: 80 },
      ],
    });

    assert.equal(sortRes.success, true, `批量创建分拣任务失败: ${sortRes.message}`);
    assert.equal(sortRes.codes?.length, 2, `返回的分拣单号数必须为 2，实际为: ${sortRes.codes?.length}`);

    const tasks = await prisma.sortTask.findMany({
      where: { code: { in: sortRes.codes! } },
    });
    assert.equal(tasks.length, 2, "数据库中实际创建的分拣任务数与预期不符");
    createdSortTaskIds.push(...tasks.map((t) => t.id));
    console.log(`  ✔ 分拣批量创建成功: 任务单号 [${sortRes.codes?.join(", ")}]，涉及不同规格分别立卷留痕`);

    // -------------------------------------------------------------------------
    // 5. 验证分拣超额投入拦截
    // -------------------------------------------------------------------------
    console.log("\n▶ [Test 5] 验证分拣超额投入硬拦截");
    const overRes = await createSortTasksAction({
      machineId: machine.id,
      bundleBatchId: bundleBatch.id,
      items: [
        { gender: "MALE", weightTier: "4.0两", inputCount: 9999 }, // 超过150
      ],
    });
    assert.equal(overRes.success, false, "超额投入未被拦截！");
    console.log(`  ✔ 超额投入拦截成功: ${overRes.message}`);

    console.log("\n================================================================================");
    console.log("🎉 全部 5 项改动功能验证测试 100% 通过！");
    console.log("================================================================================");
  } finally {
    // 清理测试数据
    console.log("\n🧹 正在清理自动化测试临时记录...");
    for (const id of createdQcIds) {
      await prisma.qCRecord.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdSortTaskIds) {
      await prisma.sortTask.delete({ where: { id } }).catch(() => {});
    }
    if (testBundleBatchId) {
      await prisma.bundleLine.deleteMany({ where: { bundleBatchId: testBundleBatchId } }).catch(() => {});
      await prisma.bundleBatch.delete({ where: { id: testBundleBatchId } }).catch(() => {});
    }
    if (testBundleGroupId) {
      await prisma.bundleGroup.delete({ where: { id: testBundleGroupId } }).catch(() => {});
    }
    if (testTagClaimId) {
      await prisma.tagClaim.delete({ where: { id: testTagClaimId } }).catch(() => {});
    }
    if (testPoolId) {
      await prisma.holdingPool.delete({ where: { id: testPoolId } }).catch(() => {});
    }
    if (testFarmerId) {
      await prisma.farmer.delete({ where: { id: testFarmerId } }).catch(() => {});
    }
    if (testMachineId) {
      await prisma.sortMachine.delete({ where: { id: testMachineId } }).catch(() => {});
    }
    console.log("✔ 清理完成");
  }
}

runOutboundQcTest();
