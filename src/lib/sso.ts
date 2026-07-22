import "server-only";
import { getSystemConfig } from "./system-config";

// qwq-sso 对接（见 https://github.com/uesrbai/qwq-sso）
// 流程：跳转 {ROOT}/login.html?redirect=<回调> → 用户登录后带 token 回调
//       → 后端用 API Key 调 {ROOT}/api/v1/auth/verify 校验 token 拿到用户信息

export type SsoUser = {
  id: string;
  uid_seq?: number;
  name?: string;
  email?: string;
  status?: string;
  role?: string;
};

/** 读取并规范化 SSO 配置（优先数据库设置，回落环境变量）。兼容地址带 /api/v1 后缀。 */
export async function getSsoConfig() {
  const { ssoBaseUrl, ssoApiKey } = await getSystemConfig();
  if (!ssoBaseUrl || !ssoApiKey) return null;
  let root = ssoBaseUrl.trim().replace(/\/+$/, "").replace(/\/api\/v\d+$/i, "");
  // 用户常忘填协议头，自动补 https://，否则拼出的跳转地址无效
  if (!/^https?:\/\//i.test(root)) root = `https://${root}`;
  return { root, apiBase: `${root}/api/v1`, apiKey: ssoApiKey };
}

export async function isSsoEnabled() {
  return (await getSsoConfig()) !== null;
}

export function buildSsoLoginUrl(root: string, redirectUri: string) {
  return `${root}/login.html?redirect=${encodeURIComponent(redirectUri)}`;
}

type ReqLike = { headers: Headers; nextUrl: { origin: string; host: string } };

/**
 * 对外可见的应用根地址。部署在反向代理（Zeabur）后面时，req 自身的地址是内部的
 * localhost:8080，不能用；优先系统设置里的 appUrl，其次代理转发头 x-forwarded-host。
 */
export async function ssoPublicBase(req: ReqLike): Promise<string> {
  const { appUrl } = await getSystemConfig();
  let configured = appUrl.trim().replace(/\/+$/, "");
  if (configured) {
    if (!/^https?:\/\//i.test(configured)) configured = `https://${configured}`;
    return configured;
  }
  return baseFromHeaders(req);
}

/** 不查数据库、纯从转发头推断根地址（异常兜底用） */
export function baseFromHeaders(req: ReqLike): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}

/** SSO 回调地址：必须与 SSO 后台注册的 callback_url 完全一致 */
export function ssoCallbackUrl(base: string): string {
  return `${base.replace(/\/+$/, "")}/api/auth/sso/callback`;
}

/** 用本应用的 API Key 校验用户 token，成功返回用户信息 */
export async function verifySsoToken(token: string): Promise<SsoUser | null> {
  const cfg = await getSsoConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.apiBase}/auth/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "x-user-token": token,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { valid?: boolean; user?: SsoUser };
    if (!data?.valid || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}
