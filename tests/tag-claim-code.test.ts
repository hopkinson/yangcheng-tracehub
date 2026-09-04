import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { requestTagClaimAction } from "../src/actions/tags";
import { getBeijingDateStr } from "../src/lib/utils";

async function testTagClaimCode() {
  console.log("=== Testing Tag Claim Code Generation ===");

  const farmer = await prisma.farmer.findFirst({ where: { status: "ACTIVE" } });
  const applicant = await prisma.user.findFirst();

  if (!farmer || !applicant) {
    throw new Error("Missing test seed data (farmer or applicant)");
  }

  const claim = await requestTagClaimAction({
    farmerId: farmer.id,
    claimCount: 1,
    applicantId: applicant.id,
  });

  console.log("Claim result code:", claim.code);

  const dateStr = getBeijingDateStr();
  const expectedPrefix = `XK${dateStr}`;

  assert.ok(claim.code, "claim.code is null or undefined");
  assert.match(
    claim.code,
    new RegExp(`^${expectedPrefix}\\d{2,}$`),
    `Expected claim.code to match ^${expectedPrefix}\\d{2,}$, got: ${claim.code}`
  );

  // Test sequential increment
  const claim2 = await requestTagClaimAction({
    farmerId: farmer.id,
    claimCount: 1,
    applicantId: applicant.id,
  });

  console.log("Claim 2 result code:", claim2.code);
  assert.ok(claim2.code, "claim2.code is null or undefined");
  
  const seq1 = parseInt(claim.code.slice(expectedPrefix.length), 10);
  const seq2 = parseInt(claim2.code.slice(expectedPrefix.length), 10);
  assert.equal(seq2, seq1 + 1, `Expected seq2 (${seq2}) to be seq1 + 1 (${seq1 + 1})`);

  console.log(`✔ Sequential test passed: ${claim.code} -> ${claim2.code}`);
}

testTagClaimCode()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("TEST FAILED AS EXPECTED:", err.message);
    process.exit(1);
  });
