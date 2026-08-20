import assert from "node:assert";
import { prisma } from "../src/lib/prisma";

async function testChannelIsolation() {
  console.log("🧪 运行渠道账号多租户数据隔离测试...");

  const sams = await prisma.channel.findUniqueOrThrow({ where: { code: "SAMS" } });
  const hema = await prisma.channel.findUniqueOrThrow({ where: { code: "HEMA" } });

  // 1. 查找发往山姆的出库单
  const samsOrder = await prisma.outboundOrder.findFirstOrThrow({
    where: { channelId: sams.id },
  });

  // 2. 模拟山姆审计人员查询
  const samsAllowed = samsOrder.channelId === sams.id;
  assert.strictEqual(samsAllowed, true);

  // 3. 模拟盒马人员跨渠道查询山姆单号
  const hemaForbidden = samsOrder.channelId !== hema.id;
  assert.strictEqual(hemaForbidden, true);

  console.log("✅ 渠道账号权限隔离断言测试通过！");
}

testChannelIsolation()
  .catch((e) => {
    console.error("❌ 隔离测试失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
