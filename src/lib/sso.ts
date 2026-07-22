import "server-only";
import { getSystemConfig } from "./system-config";

// qwq-sso 对接 —— OIDC 标准流程（文档第十章）
//   授权：GET  {root}/oauth/authorize?client_id&redirect_uri&response_type=code&scope&state
//   换票：POST {root}/oauth/token   { grant_type, code, redirect_uri, client_id, client_secret }
//   取信息：GET {root}/oauth/userinfo  Authorization: Bearer <access_token>

export type OidcUser = {
  sub: string; // 用户唯一标识
  name?: string;
  email?: string;
  status?: string;
};

type ReqLike = { headers: Headers; nextUrl: { origin: string; host: string } };

function normalizeRoot(raw: string): string {
  let root = raw.trim().replace(/\/+$/, "").replace(/\/api\/v\d+$/i, "");
  if (!/^https?:\/\//i.test(root)) root = `https://${root}`;
  return root;
}

/** OIDC 配置：需要 服务地址 + client_id + client_secret */
export async function getSsoOidcConfig() {
  const { ssoBaseUrl, ssoClientId, ssoClientSecret } = await getSystemConfig();
  if (!ssoBaseUrl || !ssoClientId || !ssoClientSecret) return null;
  return { root: normalizeRoot(ssoBaseUrl), clientId: ssoClientId, clientSecret: ssoClientSecret };
}

export async function isSsoEnabled() {
  return (await getSsoOidcConfig()) !== null;
}

/** 对外可见的应用根地址：系统设置 appUrl > 代理转发头 x-forwarded-host > req 自身 */
export async function ssoPublicBase(req: ReqLike): Promise<string> {
  const { appUrl } = await getSystemConfig();
  let configured = appUrl.trim().replace(/\/+$/, "");
  if (configured) {
    if (!/^https?:\/\//i.test(configured)) configured = `https://${configured}`;
    return configured;
  }
  return baseFromHeaders(req);
}

export function baseFromHeaders(req: ReqLike): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}

/** SSO 回调地址：必须与 SSO 后台注册的 callback_url 完全一致 */
export function ssoCallbackUrl(base: string): string {
  return `${base.replace(/\/+$/, "")}/api/auth/sso/callback`;
}

/** 拼授权页地址 */
export function buildAuthorizeUrl(
  root: string,
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email",
    state,
  });
  return `${root}/oauth/authorize?${params.toString()}`;
}

/** 用授权码换令牌 */
export async function exchangeCodeForToken(
  cfg: { root: string; clientId: string; clientSecret: string },
  code: string,
  redirectUri: string,
): Promise<{ access_token?: string; id_token?: string } | null> {
  try {
    const res = await fetch(`${cfg.root}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { access_token?: string; id_token?: string };
  } catch {
    return null;
  }
}

/** 用 access_token 取用户信息 */
export async function fetchOidcUserInfo(root: string, accessToken: string): Promise<OidcUser | null> {
  try {
    const res = await fetch(`${root}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sub?: string; name?: string; email?: string; status?: string };
    if (!data?.sub) return null;
    return { sub: String(data.sub), name: data.name, email: data.email, status: data.status };
  } catch {
    return null;
  }
}
