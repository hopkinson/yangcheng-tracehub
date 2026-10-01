import { prisma } from "../src/lib/prisma";

/**
 * 历史数据出库时间刷平：
 * 将所有已审批历史出库单的 outboundTime 一键对齐为 approvedAt
 */
async function main() {
  const updatedCount = await prisma.$executeRawUnsafe(
    `UPDATE "OutboundOrder" SET "outboundTime" = "approvedAt" WHERE "status" = 'APPROVED' AND "approvedAt" IS NOT NULL;`
  );
  console.log(`✅ 成功更新 ${updatedCount} 笔已审批出库单出库时间为审批时间 (approvedAt)。`);
}

main()
  .catch((err) => {
    console.error("执行失败:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
