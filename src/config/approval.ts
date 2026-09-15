export const APPROVAL_ROLES = ["FARMER_ADMIN", "QA_DIRECTOR", "WAREHOUSE_ADMIN"] as const;

export type ApprovalRole = (typeof APPROVAL_ROLES)[number];

export const APPROVAL_ROLE_LABELS: Record<ApprovalRole, string> = {
  FARMER_ADMIN: "内部核验员",
  QA_DIRECTOR: "品控主管",
  WAREHOUSE_ADMIN: "仓库管理员",
};

export const DEFAULT_APPROVAL_SETTING = {
  tagClaimRole: "FARMER_ADMIN" as ApprovalRole,
  outboundRole: "QA_DIRECTOR" as ApprovalRole,
};

export const TAG_CLAIM_APPROVAL = {
  pendingLabel: "待审批",
};

export function isApprovalRole(role: string): role is ApprovalRole {
  return APPROVAL_ROLES.includes(role as ApprovalRole);
}

export function approvalRoles(configuredRole: ApprovalRole): string[] {
  return [configuredRole, "ADMIN"];
}

export function canApprove(role: string | null | undefined, configuredRole: ApprovalRole) {
  return Boolean(role && (role === "ADMIN" || role === configuredRole));
}
