import { SignJWT, jwtVerify } from "jose";

// 登录会话：签名后的 JWT，存在 httpOnly Cookie 里
export const SESSION_COOKIE = "qwq_session";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me",
);

export type SessionPayload = {
  uid: string;
  role: string;
  name: string;
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      uid: String(payload.uid),
      role: String(payload.role),
      name: String(payload.name),
    };
  } catch {
    return null;
  }
}
