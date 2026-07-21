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
  const root = ssoBaseUrl.replace(/\/+$/, "").replace(/\/api\/v\d+$/i, "");
  return { root, apiBase: `${root}/api/v1`, apiKey: ssoApiKey };
}

export async function isSsoEnabled() {
  return (await getSsoConfig()) !== null;
}

export function buildSsoLoginUrl(root: string, redirectUri: string) {
  return `${root}/login.html?redirect=${encodeURIComponent(redirectUri)}`;
}

/**
 * SSO 回调地址。必须与后台注册的 callback_url 完全一致，
 * 所以优先用 APP_URL（固定公开域名），代理后面 req 的地址不可靠。
 */
export async function ssoCallbackUrl(fallbackOrigin: string): Promise<string> {
  const { appUrl } = await getSystemConfig();
  const base = (appUrl || fallbackOrigin).replace(/\/+$/, "");
  return `${base}/api/auth/sso/callback`;
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
