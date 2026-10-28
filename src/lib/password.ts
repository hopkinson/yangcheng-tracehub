import crypto from "crypto";

const SALT = "yangcheng_crab_salt_2026";

export function hashPassword(password: string): string {
  return crypto.scryptSync(password.trim(), SALT, 32).toString("hex");
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  // 兼容种子数据与历史明文密码
  if (storedHash === password) return true;
  const computed = hashPassword(password);
  return computed === storedHash;
}
