import { prisma } from "../src/lib/prisma";
import { parseBeijingDateTime, formatFullDateTime } from "../src/lib/utils";

/**
 * 出库时间批次修正工具
 * 
 * 用法 1 (直接传参):
 *   pnpm exec tsx scripts/update-outbound-time.ts CK-20261001-005 2026-10-02T00:10:00
 * 
 * 用法 2 (统一修改某批次范围):
 *   pnpm exec tsx scripts/update-outbound-time.ts --prefix CK-20261001- 2026-10-02T00:10:00
 */

export interface TimeUpdateItem {
  code: string;
  newOutboundTime: string | Date;
  reason?: string;
}

export async function updateOutboundTimes(
  items: TimeUpdateItem[],
  operatorId = "SYSTEM_ADMIN"
): Promise<{ success: boolean; count: number; results: any[] }> {
  const results: any[] = [];

  for (const item of items) {
    const order = await prisma.outboundOrder.findUnique({
      where: { code: item.code },
      select: { id: true, code: true, outboundTime: true, status: true },
    });

    if (!order) {
      console.warn(`⚠️ [跳过] 未找到出库批次: ${item.code}`);
      continue;
    }

    const previousTime = order.outboundTime;
    const targetDate = parseBeijingDateTime(item.newOutboundTime);

    await prisma.$transaction(async (tx) => {
      // 1. 更新实际/预约出库时间
      await tx.outboundOrder.update({
        where: { id: order.id },
        data: { outboundTime: targetDate },
      });

      // 2. 写入审计日志留痕（符合 PRD 合规要求）
      await tx.auditLog.create({
        data: {
          operatorId,
          action: "UPDATE_OUTBOUND_TIME",
          entityType: "OUTBOUND_ORDER",
          entityId: order.id,
          details: JSON.stringify({
            orderCode: order.code,
            previousOutboundTime: previousTime.toISOString(),
            newOutboundTime: targetDate.toISOString(),
            reason: item.reason || "历史预约出库时间校正",
          }),
        },
      });
    });

    results.push({
      code: order.code,
      previous: formatFullDateTime(previousTime),
      updated: formatFullDateTime(targetDate),
    });
  }

  return { success: true, count: results.length, results };
}

// CLI 执行入口
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(`
出库批次时间批量修改工具:
  1. 单笔修改:
     pnpm exec tsx scripts/update-outbound-time.ts <出库批次号> <新出库时间>
     例如: pnpm exec tsx scripts/update-outbound-time.ts CK-20261001-005 "2026-10-02 00:10"

  2. 批量前缀匹配统一修改:
     pnpm exec tsx scripts/update-outbound-time.ts --prefix <批次前缀> <新出库时间>
     例如: pnpm exec tsx scripts/update-outbound-time.ts --prefix CK-20261001- "2026-10-02 00:10"
`);
    return;
  }

  if (args[0] === "--prefix" && args.length >= 3) {
    const prefix = args[1];
    const newTime = args[2];
    const orders = await prisma.outboundOrder.findMany({
      where: { code: { startsWith: prefix } },
      select: { code: true },
      orderBy: { code: "asc" },
    });

    if (orders.length === 0) {
      console.log(`❌ 未找到匹配前缀 "${prefix}" 的出库批次。`);
      return;
    }

    console.log(`🔍 找到 ${orders.length} 笔匹配批次，准备将出库时间修正为: ${newTime}...`);
    const items = orders.map((o) => ({ code: o.code, newOutboundTime: newTime }));
    const { count, results } = await updateOutboundTimes(items);
    console.table(results);
    console.log(`✅ 成功修正 ${count} 笔出库单的预约出库时间！`);
    return;
  }

  if (args.length >= 2) {
    const [code, newTime] = args;
    console.log(`🔍 准备将单据 ${code} 的出库时间修正为: ${newTime}...`);
    const { count, results } = await updateOutboundTimes([
      { code, newOutboundTime: newTime },
    ]);
    console.table(results);
    console.log(`✅ 成功修正 ${count} 笔出库单！`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("update-outbound-time.ts")) {
  main()
    .catch((err) => {
      console.error("执行失败:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
