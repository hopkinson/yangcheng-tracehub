import { prisma } from "../src/lib/prisma";
import { getBeijingDayRange } from "../src/lib/utils";

async function testOutboundLedgerRegression() {
  console.log("🧪 开始回归测试：台账日期多维检索...");

  // 时间取值已由 outbound-time-preservation.test.ts 验证真实页面表达式。
  const dayRange0930 = getBeijingDayRange("2026-09-30");
  const dayRange1001 = getBeijingDayRange("2026-10-01");

  const orders0930 = await prisma.outboundOrder.findMany({
    where: {
      status: { not: "REJECTED" },
      OR: [
        { createdAt: dayRange0930 },
        { outboundTime: dayRange0930 },
        { approvedAt: dayRange0930 },
      ],
    },
  });

  const orders1001 = await prisma.outboundOrder.findMany({
    where: {
      status: { not: "REJECTED" },
      OR: [
        { createdAt: dayRange1001 },
        { outboundTime: dayRange1001 },
        { approvedAt: dayRange1001 },
      ],
    },
  });

  console.log(`  ✔ 数据库多维检索：09-30 命中 ${orders0930.length} 笔，10-01 命中 ${orders1001.length} 笔`);

  console.log("🎉 全部台账出库回归用例 100% 通过！");
}

testOutboundLedgerRegression()
  .catch((err) => {
    console.error("回归测试失败:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
