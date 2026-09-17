import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createQCRecordAction } from "../src/actions/qc";

const prisma = new PrismaClient();

async function run() {
  console.log("🧪 测试原料批次品控留痕台账查询与复合过滤...");

  const timestamp = Date.now();
  const testBatchCode = `YL-TEST-${timestamp}`;

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  assert.ok(admin, "Admin user must exist");

  const farmer = await prisma.farmer.findFirst({
    where: { status: "ACTIVE" },
    include: { enclosures: true },
  });
  assert.ok(farmer, "Farmer must exist");
  assert.ok(farmer.enclosures.length > 0, "Farmer must have enclosure");

  const pool = await prisma.holdingPool.findFirst({ where: { status: "ACTIVE" } });
  assert.ok(pool, "Pool must exist");

  // 创建一个测试批次
  const batch = await prisma.batch.create({
    data: {
      code: testBatchCode,
      farmer: { connect: { id: farmer.id } },
      enclosure: { connect: { id: farmer.enclosures[0].id } },
      pool: { connect: { id: pool.id } },
      gender: "MALE",
      weightTier: "4.0两",
      inPoolCount: 100,
      createdBy: { connect: { id: admin.id } },
      formNo: "YCGF-PZZX-TEST",
    },
  });

  console.log("▶ [步骤 1] 录入农残快检与抽检试吃两条留痕记录");
  const quickRes = await createQCRecordAction({
    cat: "QUICK_CHECK",
    formNo: "YCGF-PZZX-202601",
    refType: "BATCH",
    refId: batch.code,
    title: "原料兽药农残快检",
    checkTime: "2026-09-21T08:30",
    conclusion: "合格",
    uploader: admin.fullName,
    fileName: `${testBatchCode}_农残快检合格.jpg`,
    fileUrl: "/uploads/reports/test-quick.jpg",
  });
  assert.strictEqual(quickRes.success, true);

  const tasteRes = await createQCRecordAction({
    cat: "TASTE_CHECK",
    formNo: "YCGF-PZZX-202602",
    refType: "BATCH",
    refId: batch.code,
    title: "品质抽检与试吃记录",
    checkTime: "2026-09-21T09:15",
    conclusion: "品质抽检异常，需复核或整改",
    reason: "蟹黄饱和度不足，安排复检",
    uploader: admin.fullName,
    fileName: `${testBatchCode}_试吃记录.jpg`,
    fileUrl: "/uploads/reports/test-taste.jpg",
  });
  assert.strictEqual(tasteRes.success, true);

  console.log("▶ [步骤 2] 校验批次品控台账按批次号过滤");
  const recordsByBatch = await prisma.qCRecord.findMany({
    where: {
      refType: "BATCH",
      cat: { in: ["QUICK_CHECK", "TASTE_CHECK"] },
      refId: testBatchCode,
    },
    orderBy: { checkTime: "desc" },
  });
  assert.strictEqual(recordsByBatch.length, 2, "该批次应有 2 条品控记录");
  assert.strictEqual(recordsByBatch[0].cat, "TASTE_CHECK");
  assert.strictEqual(recordsByBatch[0].result, "RECTIFYING");
  assert.strictEqual(recordsByBatch[1].cat, "QUICK_CHECK");
  assert.strictEqual(recordsByBatch[1].result, "QUALIFIED");

  console.log("▶ [步骤 3] 校验批次品控台账按类别过滤");
  const quickOnly = await prisma.qCRecord.findMany({
    where: {
      refType: "BATCH",
      cat: "QUICK_CHECK",
      refId: testBatchCode,
    },
  });
  assert.strictEqual(quickOnly.length, 1, "农残分类过滤应仅有 1 条记录");
  assert.strictEqual(quickOnly[0].cat, "QUICK_CHECK");

  console.log("▶ [步骤 4] 清理测试数据");
  await prisma.qCRecord.deleteMany({ where: { refId: testBatchCode } });
  await prisma.batch.delete({ where: { id: batch.id } });

  console.log("🎉 原料批次品控留痕台账查询与过滤自动化测试通过！");
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
