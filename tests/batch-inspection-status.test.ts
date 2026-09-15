import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createMultiSpecBatchAction } from "../src/actions/batches";
import { createQCRecordAction } from "../src/actions/qc";

const prisma = new PrismaClient();

async function run() {
  console.log("🧪 测试原料批次品控快检/抽检初始状态与报告填报闭环...");

  const timestamp = Date.now();
  const farmer = await prisma.farmer.create({
    data: {
      code: `JD-QA-${timestamp}`,
      name: `测试户-${timestamp}`,
      phone: `137${String(timestamp).slice(-8)}`,
      farmType: "LAKE_CRAB",
      year: 2026,
      area: 10,
      quota: 6000,
      status: "ACTIVE",
      enclosures: {
        create: [{ code: `W-QA-${timestamp}`, description: "测试围网" }],
      },
    },
    include: { enclosures: true },
  });

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  assert.ok(admin, "Admin user must exist");

  const pool = await prisma.holdingPool.create({
    data: { code: `ZY-QA-${timestamp}`, name: `品控测试池-${timestamp}`, status: "ACTIVE" },
  });

  // 1. 刚创建（上传码单）批次：未上传/填写检测报告前，状态必须为 PENDING (待检测)
  console.log("▶ [步骤 1] 校验刚创建批次默认品控状态为待检测 (PENDING)");
  const res = await createMultiSpecBatchAction({
    farmerId: farmer.id,
    enclosureId: farmer.enclosures[0].id,
    formNo: "YCGF-QA-001",
    temp: 18.5,
    humidity: 85.0,
    escort: "押运员",
    items: [
      { poolId: pool.id, gender: "MALE", weightTier: "4.0两", weight: 300, inPoolCount: 1000 },
    ],
    createdById: admin.id,
  });

  assert.strictEqual(res.success, true, `Batch creation should succeed: ${res.error}`);
  const batchId = res.data?.id;
  assert.ok(batchId, "Batch id should exist");

  let batch = await prisma.batch.findUniqueOrThrow({ where: { id: batchId } });

  console.log("  刚上传入池时 batch.quickCheck:", batch.quickCheck);
  console.log("  刚上传入池时 batch.sampleCheck:", batch.sampleCheck);

  assert.strictEqual(
    batch.quickCheck,
    "PENDING",
    "刚上传时农残快检应为 PENDING（待检测），不可默认为合格"
  );
  assert.strictEqual(
    batch.sampleCheck,
    "PENDING",
    "刚上传时抽检试吃应为 PENDING（待抽检），不可默认为合格"
  );
  assert.strictEqual(batch.quickCheckUrl, null, "刚上传时无农残报告");
  assert.strictEqual(batch.sampleCheckUrl, null, "刚上传时无试吃报告");
  console.log("  ✔ 刚上传批次品控状态验证为 PENDING (待检测)");

  // 2. 通过统一 QC 留痕分别录入农残与试吃，批次状态应同步合格/不合格
  console.log("▶ [步骤 2] 校验统一 QC 留痕会同步批次快检/抽检状态");
  const quickRes = await createQCRecordAction({
    cat: "QUICK_CHECK",
    formNo: "YCGF-PZZX-202601",
    refType: "BATCH",
    refId: batch.code,
    title: `${batch.code} 农残快速检测`,
    checkTime: new Date().toISOString(),
    conclusion: "全部指标符合要求，未检出违禁药物",
    uploader: admin.fullName,
    fileUrl: "/uploads/reports/test-quick-check.pdf",
    fileName: "阳澄湖大闸蟹农药残留快速检测合格单.pdf",
  });
  const tasteRes = await createQCRecordAction({
    cat: "TASTE_CHECK",
    formNo: "YCGF-PZZX-202602",
    refType: "BATCH",
    refId: batch.code,
    title: `${batch.code} 品质抽检与试吃`,
    checkTime: new Date().toISOString(),
    conclusion: "品质抽检异常，需复核或整改",
    reason: "试吃发现异常，安排复核",
    uploader: admin.fullName,
    fileUrl: "/uploads/reports/test-sample-check.jpg",
    fileName: "品质抽检试吃记录表.jpg",
  });

  assert.strictEqual(quickRes.success, true, `Quick QC create should succeed: ${quickRes.message}`);
  assert.strictEqual(tasteRes.success, true, `Taste QC create should succeed: ${tasteRes.message}`);

  batch = await prisma.batch.findUniqueOrThrow({ where: { id: batchId } });
  assert.strictEqual(batch.quickCheck, "QUALIFIED", "填报后农残快检应为 QUALIFIED (合格)");
  assert.strictEqual(batch.sampleCheck, "UNQUALIFIED", "异常抽检试吃应同步为 UNQUALIFIED (不合格)");
  assert.strictEqual(batch.quickCheckUrl, "/uploads/reports/test-quick-check.pdf");
  assert.strictEqual(batch.sampleCheckUrl, "/uploads/reports/test-sample-check.jpg");
  console.log("  ✔ QC 留痕成功同步批次合格/不合格状态并绑定报告");

  // 3. 在入库时直接携带品控报告上传：状态应直接为 QUALIFIED 并附带报告
  console.log("▶ [步骤 3] 校验入池时直接携带品控报告登记入库");
  const pool2 = await prisma.holdingPool.create({
    data: { code: `ZY-QA2-${timestamp}`, name: `品控测试池2-${timestamp}`, status: "ACTIVE" },
  });

  const resDirect = await createMultiSpecBatchAction({
    farmerId: farmer.id,
    enclosureId: farmer.enclosures[0].id,
    formNo: "YCGF-QA-002",
    temp: 18.2,
    humidity: 84.0,
    escort: "质检兼押运员",
    quickCheck: "QUALIFIED",
    quickCheckUrl: "/uploads/reports/direct-quick.pdf",
    quickCheckName: "到货快检合格单.pdf",
    sampleCheck: "QUALIFIED",
    sampleCheckUrl: "/uploads/reports/direct-sample.jpg",
    sampleCheckName: "到货试吃品评表.jpg",
    items: [
      { poolId: pool2.id, gender: "MALE", weightTier: "4.0两", weight: 300, inPoolCount: 1000 },
    ],
    createdById: admin.id,
  });

  assert.strictEqual(resDirect.success, true, `Direct creation should succeed: ${resDirect.error}`);
  const directBatchId = resDirect.data?.id;
  assert.ok(directBatchId);

  const directBatch = await prisma.batch.findUniqueOrThrow({ where: { id: directBatchId } });
  assert.strictEqual(directBatch.quickCheck, "QUALIFIED", "直接携带报告入库应为 QUALIFIED");
  assert.strictEqual(directBatch.sampleCheck, "QUALIFIED", "直接携带报告入库应为 QUALIFIED");
  assert.strictEqual(directBatch.quickCheckUrl, "/uploads/reports/direct-quick.pdf");
  assert.strictEqual(directBatch.sampleCheckUrl, "/uploads/reports/direct-sample.jpg");
  console.log("  ✔ 入池时直接携带品控报告创建成功且状态为合格");

  // 清理测试数据，避免污染正式台账与列表
  console.log("▶ [步骤 4] 清理本次测试生成的批次与隔离池");
  await prisma.qCRecord.deleteMany({ where: { refType: "BATCH", refId: batch.code } });
  await prisma.batchItem.deleteMany({ where: { batchId: { in: [batchId, directBatchId] } } });
  await prisma.auditLog.deleteMany({ where: { entityType: "BATCH", entityId: { in: [batchId, directBatchId] } } });
  await prisma.batch.deleteMany({ where: { id: { in: [batchId, directBatchId] } } });
  await prisma.holdingPool.deleteMany({ where: { id: { in: [pool.id, pool2.id] } } });
  await prisma.enclosure.deleteMany({ where: { farmerId: farmer.id } });
  await prisma.farmer.delete({ where: { id: farmer.id } });
  console.log("  ✔ 测试环境现场清理完毕");

  console.log("🎉 全部品控快检/抽检状态流转与填报闭环测试通过！");
}

run()
  .catch((err) => {
    console.error("❌ 测试失败:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
