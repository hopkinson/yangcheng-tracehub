import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { createQCRecordAction, deleteQCRecordAction } from "../src/actions/qc";

async function runColdStorageQCTest() {
  console.log("▶ [Test] 保鲜库巡检与温湿度质检留痕闭环测试 (COLD_TEMP / YCGF-PZZX-202609)");

  // 1. 测试正常保鲜巡检记录提交
  const testStoreCode = "BX-01";
  const checkTime = "2026-09-21T10:30";
  const resNormal = await createQCRecordAction({
    cat: "COLD_TEMP",
    formNo: "YCGF-PZZX-202609",
    refType: "STORE",
    refId: testStoreCode,
    title: "保鲜库温湿度监控记录表 (BX-01 预冷A区)",
    checkTime,
    conclusion: "温度 4.2℃，湿度 65%，冷风循环正常",
    uploader: "赵质检 (质检员)",
    fileName: "BX_test_record.jpg",
  });

  assert.equal(resNormal.success, true, "巡检记录应成功创建");
  assert.ok(resNormal.code?.startsWith("BX"), `巡检单号应以 BX 开头，实际为: ${resNormal.code}`);
  console.log(`  ✔ 正常保鲜温湿度巡检提交成功: ${resNormal.code}`);

  // 2. 验证数据库内存在该记录且字段正确
  const record = await prisma.qCRecord.findUnique({
    where: { code: resNormal.code },
  });
  assert.ok(record, "数据库中应查得该巡检记录");
  assert.equal(record?.cat, "COLD_TEMP", "品控类别应为 COLD_TEMP");
  assert.equal(record?.formNo, "YCGF-PZZX-202609", "纸质表号应为 YCGF-PZZX-202609");
  assert.equal(record?.refId, testStoreCode, "关联库位应为 BX-01");
  assert.equal(record?.result, "QUALIFIED", "正常结论判定应为 QUALIFIED");
  console.log("  ✔ 数据库字段持久化及 QUALIFIED 判定验证通过");

  // 3. 测试异常巡检记录带整改原因提交
  const resException = await createQCRecordAction({
    cat: "COLD_TEMP",
    formNo: "YCGF-PZZX-202609",
    refType: "STORE",
    refId: "BX-02",
    title: "保鲜库温湿度监控记录表 (BX-02 预冷B区)",
    checkTime,
    conclusion: "温度超标 (>6℃)，制冷循环异常",
    reason: "冷风机化霜传感器故障，已通知工程部紧急抢修",
    uploader: "赵质检 (质检员)",
  });

  assert.equal(resException.success, true, "异常巡检记录应成功创建");
  const expRecord = await prisma.qCRecord.findUnique({
    where: { code: resException.code },
  });
  assert.equal(expRecord?.result, "EXCEPTION", "包含异常关键词应推导判定为 EXCEPTION");
  assert.ok(expRecord?.reason?.includes("化霜传感器"), "应完整保存异常整改原因说明");
  console.log(`  ✔ 异常保鲜巡检自动判定 EXCEPTION 验证通过: ${resException.code}`);

  // 4. 清理本次测试数据
  if (record) await deleteQCRecordAction(record.id);
  if (expRecord) await deleteQCRecordAction(expRecord.id);
  console.log("  ✔ 测试临时记录清理完毕\n");

  console.log("🎉 保鲜库温湿度巡检所有功能测试 100% 通过！");
}

runColdStorageQCTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
