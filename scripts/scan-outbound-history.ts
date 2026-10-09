import { prisma } from "../src/lib/prisma";

async function main() {
  const orders = await prisma.outboundOrder.findMany({
    select: {
      code: true,
      status: true,
      approvedAt: true,
      outboundTime: true,
    },
    orderBy: { code: "asc" },
  });

  const dateStats = new Map<string, {
    date: string;
    total: number;
    approved: number;
    overwritten: number;
    independent: number;
  }>();

  for (const o of orders) {
    const rawDate = o.code.slice(3, 11);
    const dateKey = rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : "OTHER";

    if (!dateStats.has(dateKey)) {
      dateStats.set(dateKey, { date: dateKey, total: 0, approved: 0, overwritten: 0, independent: 0 });
    }
    const stat = dateStats.get(dateKey)!;
    stat.total++;
    if (o.status === "APPROVED") stat.approved++;

    const isOverwritten = Boolean(
      o.approvedAt &&
      o.outboundTime &&
      Math.abs(o.approvedAt.getTime() - o.outboundTime.getTime()) < 1000
    );

    if (isOverwritten) {
      stat.overwritten++;
    } else {
      stat.independent++;
    }
  }

  console.table(Array.from(dateStats.values()));
}

main()
  .catch((err) => {
    console.error("执行出错:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
