import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { createStoreAction, updateStoreAction } from "../src/actions/stores";

async function testStoreDuplicateRegression() {
  console.log("=== 回归测试：门店编号重复返回业务 Result 对象而非 throw 异常 ===");

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No admin found in database");

  let channel = await prisma.channel.findFirst();
  if (!channel) {
    channel = await prisma.channel.create({
      data: { name: "回归测试渠道_" + Date.now() },
    });
  }

  const testCode1 = "ST-REG-1-" + Date.now();
  const testCode2 = "ST-REG-2-" + Date.now();

  // Mock next/cache revalidatePath for standalone script
  // (revalidatePath throws if called outside Next.js request unless mocked or handled)
  const store1 = await prisma.store.create({
    data: {
      code: testCode1,
      name: "回归测试门店1",
      channelId: channel.id,
      isActive: true,
    },
  });

  const store2 = await prisma.store.create({
    data: {
      code: testCode2,
      name: "回归测试门店2",
      channelId: channel.id,
      isActive: true,
    },
  });

  // 1. 测试创建同名门店：应返回 { error: "..." }，绝对不应 throw 未捕获异常
  const createDuplicateRes = await createStoreAction({
    code: testCode1,
    name: "试图重复创建门店1",
    channelId: channel.id,
    userId: admin.id,
  });

  assert.ok(createDuplicateRes.error, "创建重复门店时必须返回 error 字段");
  assert.equal(createDuplicateRes.error, `门店编号「${testCode1}」已存在，请更换`);
  console.log("✔ createStoreAction 重复编号正确返回业务错误:", createDuplicateRes.error);

  // 2. 测试更新门店为已存在的另一家门店编号：应返回 { error: "..." }
  const updateDuplicateRes = await updateStoreAction({
    id: store2.id,
    code: testCode1,
    name: "试图改名为门店1编号",
    channelId: channel.id,
    isActive: true,
    userId: admin.id,
  });

  assert.ok(updateDuplicateRes.error, "更新为重复门店编号时必须返回 error 字段");
  assert.equal(updateDuplicateRes.error, `门店编号「${testCode1}」已存在，请更换`);
  console.log("✔ updateStoreAction 重复编号正确返回业务错误:", updateDuplicateRes.error);

  // 3. 测试空编号
  const emptyCodeRes = await createStoreAction({
    code: "   ",
    name: "空编号门店",
    channelId: channel.id,
    userId: admin.id,
  });
  assert.equal(emptyCodeRes.error, "请输入门店编号");
  console.log("✔ 空编号正确拦截返回:", emptyCodeRes.error);

  // 清理数据
  await prisma.store.deleteMany({
    where: { id: { in: [store1.id, store2.id] } },
  });

  console.log("🎉 门店编号查重回归测试全部通过！不会触发 Next.js 生产环境异常脱敏。");
}

testStoreDuplicateRegression()
  .catch((err) => {
    console.error("回归测试失败:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
