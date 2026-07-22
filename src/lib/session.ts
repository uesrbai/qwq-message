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

// SSO 待绑定：qwq-sso 授权成功但还没绑定平台账号时，
// 把 sso 身份暂存在这个短期签名令牌里，引导用户去绑定页登录绑定。
export const SSO_PENDING_COOKIE = "qwq_sso_pending";

export type SsoPending = {
  sub: string;
  email?: string;
  name?: string;
};

export async function createSsoPendingToken(p: SsoPending): Promise<string> {
  return await new SignJWT({ email: p.email ?? "", name: p.name ?? "" })
    .setSubject(p.sub)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

export async function verifySsoPendingToken(
  token: string,
): Promise<SsoPending | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    return {
      sub: String(payload.sub),
      email: payload.email ? String(payload.email) : undefined,
      name: payload.name ? String(payload.name) : undefined,
    };
  } catch {
    return null;
  }
}
