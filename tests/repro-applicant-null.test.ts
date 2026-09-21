import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";

async function testOrphanedApplicantHandledGracefully() {
  console.log("=== Testing OutboundLossOrder handles deleted/orphaned applicant gracefully ===");

  // 1. Create a temporary user
  const tempUser = await prisma.user.create({
    data: {
      phone: "13999999998",
      username: "temp_user_test_2",
      passwordHash: "test",
      fullName: "临时仓管",
      role: "WAREHOUSE_ADMIN",
    },
  });

  // 2. Create an OutboundLossOrder referencing this user
  const lossOrder = await prisma.outboundLossOrder.create({
    data: {
      code: "SH-TEST-REGRESSION-01",
      reason: "测试损耗容错",
      applicantId: tempUser.id,
      totalLossCount: 10,
    },
  });

  // 3. Simulate user deletion (e.g. data reset or user departure)
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF;");
  await prisma.user.delete({ where: { id: tempUser.id } });
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON;");

  // 4. Now query outboundLossOrder with include: { applicant: true }
  // This previously crashed with: Inconsistent query result: Field applicant is required to return data, got null instead.
  const orders = await prisma.outboundLossOrder.findMany({
    where: { id: lossOrder.id },
    include: { applicant: true },
  });

  assert.equal(orders.length, 1);
  assert.equal(orders[0].applicant, null, "applicant must be gracefully null, not throw Inconsistent query result");

  // Clean up
  await prisma.outboundLossOrder.delete({ where: { id: lossOrder.id } }).catch(() => {});

  console.log("✔ OutboundLossOrder successfully returns applicant=null without throwing exception!");
}

testOrphanedApplicantHandledGracefully().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
