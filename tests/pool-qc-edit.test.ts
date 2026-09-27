import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createQCRecordAction } from "../src/actions/qc";

const prisma = new PrismaClient();

async function run() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  assert.ok(admin);
  const record = await prisma.qCRecord.create({
    data: {
      code: `SZ-TEST-${Date.now()}`,
      cat: "WATER_QUALITY",
      refType: "POOL",
      refId: "全部暂养池",
      title: "暂养水质监测记录",
      checkTime: new Date("2026-09-25T01:00:00Z"),
      uploader: admin.fullName,
    },
  });

  try {
    const input = {
      id: record.id,
      cat: record.cat,
      refType: record.refType,
      refId: record.refId,
      title: "伪造标题",
      checkTime: "2026-09-25T10:00",
      conclusion: "待整改",
      reason: "复查水质",
      uploader: admin.fullName,
    };
    const saved = await createQCRecordAction(input);
    assert.equal(saved.success, true);

    const updated = await prisma.qCRecord.findUniqueOrThrow({ where: { id: record.id } });
    assert.equal(updated.title, record.title);
    assert.equal(updated.result, "RECTIFYING");
    assert.equal(updated.uploadTime.getTime(), record.uploadTime.getTime());

    const audit = await prisma.auditLog.findFirst({
      where: { action: "UPDATE_QC_RECORD", entityId: record.id },
    });
    assert.ok(audit);
    const details = JSON.parse(audit.details || "{}");
    assert.equal(details.before.result, record.result);
    assert.equal(details.after.result, "RECTIFYING");

    const rejected = await createQCRecordAction({ ...input, cat: "POOL_INSPECT" });
    assert.equal(rejected.success, false);
    assert.equal(await prisma.auditLog.count({ where: { action: "UPDATE_QC_RECORD", entityId: record.id } }), 1);
  } finally {
    await prisma.auditLog.deleteMany({ where: { action: "UPDATE_QC_RECORD", entityId: record.id } });
    await prisma.qCRecord.delete({ where: { id: record.id } });
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
