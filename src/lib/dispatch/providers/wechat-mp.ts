import "server-only";
import type { ChannelConfig, DispatchPayload, SendResult } from "../types";

// 微信公众号 —— 模板消息
// 流程：用 appId/appSecret 换 access_token（缓存 ~2h）→ 调模板消息接口
// payload.to = 接收者 openid；payload.templateCode = 模板ID；variables = 模板字段

type TokenEntry = { token: string; expiresAt: number };
const tokenCache = new Map<string, TokenEntry>();

async function getAccessToken(appId: string, appSecret: string, force = false): Promise<string | null> {
  const cached = tokenCache.get(appId);
  if (!force && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  try {
    const url =
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential` +
      `&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    tokenCache.set(appId, {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    });
    return data.access_token;
  } catch {
    return null;
  }
}

export async function sendWechatMp(config: ChannelConfig, payload: DispatchPayload): Promise<SendResult> {
  const { appId, appSecret, templateId } = config;
  if (!appId || !appSecret) return { ok: false, error: "微信公众号配置不完整 / incomplete config" };
  if (!payload.to) return { ok: false, error: "缺少接收者 openid / missing openid" };
  const tmplId = payload.templateCode || templateId;
  if (!tmplId) return { ok: false, error: "缺少模板消息 ID(template_id)" };

  const data: Record<string, { value: string }> = {};
  for (const [k, v] of Object.entries(payload.variables ?? {})) data[k] = { value: String(v) };
  if (Object.keys(data).length === 0 && payload.content) data.content = { value: payload.content };

  const body = JSON.stringify({ touser: payload.to, template_id: tmplId, data });

  async function post(token: string) {
    const res = await fetch(
      `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body, cache: "no-store" },
    );
    return (await res.json().catch(() => null)) as { errcode?: number; errmsg?: string; msgid?: number } | null;
  }

  let token = await getAccessToken(appId, appSecret);
  if (!token) return { ok: false, error: "获取 access_token 失败 / failed to get access_token" };

  let result = await post(token);
  // token 失效（40001/42001）刷新后重试一次
  if (result && (result.errcode === 40001 || result.errcode === 42001)) {
    token = await getAccessToken(appId, appSecret, true);
    if (token) result = await post(token);
  }

  if (!result) return { ok: false, error: "请求失败 / request failed" };
  if (result.errcode && result.errcode !== 0) {
    return { ok: false, error: result.errmsg || `errcode ${result.errcode}`, info: JSON.stringify(result) };
  }
  return { ok: true, info: JSON.stringify(result) };
}
