const SECRET_KEY =
  process.env.AUTH_SECRET || "yangcheng-tracehub-secret-key-2026-auth-session";

async function getCryptoKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export interface SessionPayload {
  userId: string;
  exp: number; // Unix timestamp (ms)
}

export const SESSION_COOKIE_NAME = "auth_session";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 86400 * 7, // 7 天 (以秒为单位)
};

/**
 * 为用户生成已签名的防篡改会话 Token
 */
export async function createSessionToken(userId: string): Promise<string> {
  const payload: SessionPayload = {
    userId,
    exp: Date.now() + 86400 * 7 * 1000, // 7 天有效期
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const key = await getCryptoKey();
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadBase64)
  );
  const signatureBase64 = Buffer.from(signatureBuffer).toString("base64url");

  return `${payloadBase64}.${signatureBase64}`;
}

/**
 * 校验会话 Token 签名与有效期
 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") return null;

  const [payloadBase64, signatureBase64] = token.split(".");
  if (!payloadBase64 || !signatureBase64) return null;

  try {
    const key = await getCryptoKey();
    const signatureBuffer = Buffer.from(signatureBase64, "base64url");

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      new TextEncoder().encode(payloadBase64)
    );

    if (!isValid) return null;

    const payload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf-8")
    ) as SessionPayload;

    if (!payload.userId || !payload.exp || Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
