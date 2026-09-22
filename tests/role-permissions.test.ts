import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { canApprove, APPROVAL_ROLES } from "../src/config/approval";
import { getApprovalSetting } from "../src/lib/approval-settings";

async function runRolePermissionTests() {
  console.log("🔒 开始测试四角色体系与山姆渠道权限隔离...\n");

  const approvalSetting = await getApprovalSetting();
  console.log("当前审批配置:", approvalSetting);

  // 1. 验证 APPROVAL_ROLES 仅包含 FARMER_ADMIN (审核员)
  assert.deepEqual(APPROVAL_ROLES, ["FARMER_ADMIN"], "可审批角色仅允许为 FARMER_ADMIN (审核员)");
  assert.equal(approvalSetting.tagClaimRole, "FARMER_ADMIN", "蟹扣审批角色必须是 FARMER_ADMIN (审核员)");
  assert.equal(approvalSetting.outboundRole, "FARMER_ADMIN", "出库审批角色必须是 FARMER_ADMIN (审核员)");
  console.log("  ✔ 审批配置与可审批角色池已严格收拢至审核员");

  // 2. 验证各角色的审批权限 canApprove
  assert.equal(canApprove("ADMIN", approvalSetting.tagClaimRole), true, "管理员拥有蟹扣审批权限");
  assert.equal(canApprove("ADMIN", approvalSetting.outboundRole), true, "管理员拥有出库审批权限");

  assert.equal(canApprove("FARMER_ADMIN", approvalSetting.tagClaimRole), true, "审核员拥有蟹扣审批权限");
  assert.equal(canApprove("FARMER_ADMIN", approvalSetting.outboundRole), true, "审核员拥有出库审批权限");

  assert.equal(canApprove("WAREHOUSE_ADMIN", approvalSetting.tagClaimRole), false, "库管员无蟹扣审批权限");
  assert.equal(canApprove("WAREHOUSE_ADMIN", approvalSetting.outboundRole), false, "库管员无出库审批权限");

  assert.equal(canApprove("QA_DIRECTOR", approvalSetting.tagClaimRole), false, "质检员无蟹扣审批权限");
  assert.equal(canApprove("QA_DIRECTOR", approvalSetting.outboundRole), false, "质检员无出库审批权限");

  assert.equal(canApprove("CHANNEL_VIEWER", approvalSetting.tagClaimRole), false, "渠道审计员无蟹扣审批权限");
  assert.equal(canApprove("CHANNEL_VIEWER", approvalSetting.outboundRole), false, "渠道审计员无出库审批权限");
  console.log("  ✔ canApprove 校验通过: 仅管理员与审核员拥有审批权，库管员与质检员严格无审批");

  console.log("\n🎉 四角色体系与山姆渠道权限隔离测试 100% 通过！");
}

runRolePermissionTests()
  .catch((err) => {
    console.error("❌ 测试失败:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
