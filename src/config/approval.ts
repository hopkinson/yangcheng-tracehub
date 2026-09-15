export const TAG_CLAIM_APPROVAL = {
  roles: ["FARMER_ADMIN", "ADMIN"],
  pendingLabel: "待内部核验",
  fallbackApproverLabel: "内部核验员",
};

export const OUTBOUND_APPROVAL = {
  roles: ["QA_DIRECTOR", "ADMIN"],
};

export function canApprove(role: string | null | undefined, roles: string[]) {
  return Boolean(role && roles.includes(role));
}
