import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { checkEnclosureCodesAction, checkFarmerNameAction, createFarmerAction, updateFarmerAction } from "../src/actions/farmers";
import { farmerFormSchema } from "../src/lib/validations/schemas";

async function run() {
  console.log("=== 诊断与回归测试：养殖户档案及围网录入全校验与查重机制 ===");

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No admin found in database");

  const timestamp = Date.now();
  const testCode1 = "W-DIAG-1-" + timestamp;
  const testCode2 = "W-DIAG-2-" + timestamp;
  const farmerName1 = "段兴龙-测试1-" + timestamp;
  const farmerName2 = "段兴龙-测试2-" + timestamp;

  // 1. 创建第一个养殖户
  const farmer1Res = await createFarmerAction({
    name: farmerName1,
    area: 5,
    creditRating: "A",
    enclosureCodes: [testCode1],
    userId: admin.id,
  });

  console.log("farmer1Res:", farmer1Res);
  assert.ok(farmer1Res.success, "正常养殖户1建档应成功");
  const farmer1 = (farmer1Res as any).data;
  console.log("✔ 养殖户1建档成功:", farmer1.name, farmer1.code);

  // 2. 创建第二个养殖户
  const farmer2Res = await createFarmerAction({
    name: farmerName2,
    area: 5,
    creditRating: "A",
    enclosureCodes: [testCode2],
    userId: admin.id,
  });

  console.log("farmer2Res:", farmer2Res);
  assert.ok(farmer2Res.success, "正常养殖户2建档应成功");
  const farmer2 = (farmer2Res as any).data;
  console.log("✔ 养殖户2建档成功:", farmer2.name, farmer2.code);

  // 3. 校验重复围网编号检查 (checkEnclosureCodesAction)
  const checkConflictRes = await checkEnclosureCodesAction({
    enclosureCodes: [testCode1, "W-NEW-" + timestamp],
    excludeFarmerId: farmer2.id,
  });
  console.log("checkEnclosureCodesAction 检查结果:", checkConflictRes);
  assert.equal(checkConflictRes.conflicts.length, 1, "应准确识别出与已存在养殖户冲突的围网编号");
  assert.equal(checkConflictRes.conflicts[0].code, testCode1);
  assert.equal(checkConflictRes.conflicts[0].farmerName, farmerName1);
  assert.equal(checkConflictRes.conflicts[0].farmerCode, farmer1.code);
  console.log("✔ checkEnclosureCodesAction 查重与回显占用详情测试通过");

  // 4. 校验养殖户姓名重复检查 (checkFarmerNameAction)
  const checkNameConflictRes = await checkFarmerNameAction({
    name: farmerName1,
    excludeFarmerId: farmer2.id,
  });
  assert.equal(checkNameConflictRes.exists, true, "已有姓名应被识别为已存在");
  assert.equal(checkNameConflictRes.conflictingFarmer?.code, farmer1.code);
  console.log("✔ checkFarmerNameAction 查重与回显档案编号测试通过");

  // 5. 测试创建养殖户时使用已存在的围网编号 (跨养殖户重复)
  const duplicateEnclosureCreateRes = await createFarmerAction({
    name: "新养殖户-" + timestamp,
    area: 5,
    creditRating: "A",
    enclosureCodes: [testCode1], // 已被 farmer1 使用
    userId: admin.id,
  });
  console.log("createFarmerAction 重复围网结果:", duplicateEnclosureCreateRes);
  assert.equal(duplicateEnclosureCreateRes.success, false, "跨户重复围网创建必须失败");
  assert.ok(
    duplicateEnclosureCreateRes.error.includes(testCode1) && duplicateEnclosureCreateRes.error.includes("占用"),
    "错误信息必须明确提示围网冲突与占用信息"
  );
  console.log("✔ createFarmerAction 跨户重复围网强校验拦截通过");

  // 6. 测试更新养殖户时使用其他养殖户已占用的围网编号
  const duplicateEnclosureUpdateRes = await updateFarmerAction({
    id: farmer2.id,
    name: farmer2.name,
    area: 5,
    creditRating: "A",
    status: "ACTIVE",
    enclosureCodes: [testCode1], // 试图将 farmer2 改为占用 farmer1 的 testCode1
    userId: admin.id,
  });
  console.log("updateFarmerAction 重复围网结果:", duplicateEnclosureUpdateRes);
  assert.equal(duplicateEnclosureUpdateRes.success, false, "跨户重复围网更新必须失败");
  assert.ok(
    duplicateEnclosureUpdateRes.error.includes(testCode1) && duplicateEnclosureUpdateRes.error.includes("占用"),
    "错误信息必须明确提示围网冲突与占用信息"
  );
  console.log("✔ updateFarmerAction 跨户重复围网强校验拦截通过");

  // 7. 测试单户内自身录入重复围网编号 (如 'GD166-2, GD166-2')
  const selfDuplicateCreateRes = await createFarmerAction({
    name: "自身重复户-" + timestamp,
    area: 5,
    creditRating: "A",
    enclosureCodes: ["W-DUP-01", "W-DUP-01"],
    userId: admin.id,
  });
  console.log("createFarmerAction 自身重复围网结果:", selfDuplicateCreateRes);
  assert.equal(selfDuplicateCreateRes.success, false, "自身重复围网编号必须失败");
  assert.ok(selfDuplicateCreateRes.error.includes("W-DUP-01"), "必须指出自身重复的编号");
  console.log("✔ createFarmerAction 自身重复围网拦截通过");

  // 8. 测试同名养殖户查重（同年度养殖户姓名不得重复）
  const duplicateNameCreateRes = await createFarmerAction({
    name: farmerName1, // 与 farmer1 同名
    area: 5,
    creditRating: "A",
    enclosureCodes: ["W-NEW-NAME-" + timestamp],
    userId: admin.id,
  });
  console.log("createFarmerAction 重复养殖户姓名结果:", duplicateNameCreateRes);
  assert.equal(duplicateNameCreateRes.success, false, "同名养殖户建档必须失败");
  assert.ok(duplicateNameCreateRes.error.includes("已存在") && duplicateNameCreateRes.error.includes("不得重复录入"));
  console.log("✔ createFarmerAction 同名养殖户查重拦截通过");

  // 9. 测试更新为已存在的养殖户姓名
  const duplicateNameUpdateRes = await updateFarmerAction({
    id: farmer2.id,
    name: farmerName1, // 试图把 farmer2 改成 farmer1 的名字
    area: 5,
    creditRating: "A",
    status: "ACTIVE",
    enclosureCodes: [testCode2],
    userId: admin.id,
  });
  console.log("updateFarmerAction 重复养殖户姓名结果:", duplicateNameUpdateRes);
  assert.equal(duplicateNameUpdateRes.success, false, "更新为同名养殖户必须失败");
  assert.ok(duplicateNameUpdateRes.error.includes("已被其他档案使用") && duplicateNameUpdateRes.error.includes("不得重复"));
  console.log("✔ updateFarmerAction 同名养殖户查重拦截通过");

  // 10. 测试 Zod Schema 录入全校验 (farmerFormSchema)
  const schemaTestEmptyEnclosure = farmerFormSchema.safeParse({
    name: "测试户",
    area: 5,
    creditRating: "A",
    enclosuresStr: "   , ,  ",
  });
  assert.equal(schemaTestEmptyEnclosure.success, false, "全空/纯逗号围网应校验失败");

  const schemaTestDuplicateEnclosures = farmerFormSchema.safeParse({
    name: "测试户",
    area: 5,
    creditRating: "A",
    enclosuresStr: "GD166-2, GD166-2",
  });
  assert.equal(schemaTestDuplicateEnclosures.success, false, "自身重复填入相同围网应校验失败");
  if (!schemaTestDuplicateEnclosures.success) {
    assert.ok(schemaTestDuplicateEnclosures.error.issues[0]?.message.includes("自身重复"));
  }

  const schemaTestInvalidSymbols = farmerFormSchema.safeParse({
    name: "测试户",
    area: 5,
    creditRating: "A",
    enclosuresStr: "GD166@#$%",
  });
  assert.equal(schemaTestInvalidSymbols.success, false, "特殊符号围网应校验失败");
  console.log("✔ farmerFormSchema 前端录入全校验（空字符、自身重复、特殊符号）测试全部通过");

  // 清理数据
  await prisma.farmer.deleteMany({
    where: { id: { in: [farmer1.id, farmer2.id] } },
  });

  console.log("🎉 养殖户与围网录入全校验、不得重复机制全部诊断并通过！");
}

run()
  .catch((err) => {
    console.error("❌ 诊断脚本异常:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
