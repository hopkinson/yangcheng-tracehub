export const APPROVAL_ROLES = ["FARMER_ADMIN"] as const;

export type ApprovalRole = (typeof APPROVAL_ROLES)[number];

export const APPROVAL_ROLE_LABELS: Record<ApprovalRole, string> = {
  FARMER_ADMIN: "审核员",
};

export const DEFAULT_APPROVAL_SETTING = {
  tagClaimRole: "FARMER_ADMIN" as ApprovalRole,
  outboundRole: "FARMER_ADMIN" as ApprovalRole,
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
