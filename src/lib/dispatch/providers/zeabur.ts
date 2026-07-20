import "server-only";
import type { ChannelConfig, DispatchPayload, SendResult } from "../types";

// Zeabur Email（官方 REST API）
// 文档：https://zeabur.com/docs/en-US/email/rest-api
//   POST https://api.zeabur.com/api/v1/zsend/emails
//   Header: Authorization: Bearer zs_xxx
//   Body: { from, to: string[], subject, html?, text?, cc?, bcc?, reply_to? }
//   成功 200 -> { id, message_id, status }
//   失败    -> { error, message }
const DEFAULT_ENDPOINT = "https://api.zeabur.com/api/v1/zsend/emails";

/** 收件人支持逗号/分号分隔的多个地址 */
function toList(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;，；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type ZeaburResp = {
  id?: string;
  message_id?: string;
  status?: string;
  error?: string;
  message?: string;
};

export async function sendZeaburEmail(config: ChannelConfig, payload: DispatchPayload): Promise<SendResult> {
  const { apiKey, from, replyTo, endpoint } = config;
  if (!apiKey || !from) return { ok: false, error: "Zeabur 邮件配置不完整（需 API Key 与发件人）" };

  const to = toList(payload.to);
  if (to.length === 0) return { ok: false, error: "缺少收件人 / missing recipient" };
  if (to.length > 50) return { ok: false, error: "收件人不能超过 50 个 / too many recipients (max 50)" };

  const body: Record<string, unknown> = {
    from,
    to,
    subject: payload.subject || "(no subject)",
    html: payload.content,
    text: payload.content,
  };
  const replies = toList(replyTo);
  if (replies.length > 0) body.reply_to = replies;

  try {
    const res = await fetch(endpoint || DEFAULT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as ZeaburResp | null;

    if (!res.ok || data?.error) {
      const msg = data?.message || data?.error || `HTTP ${res.status}`;
      return { ok: false, error: msg, info: JSON.stringify(data ?? {}) };
    }
    // 正常返回 { id, status: "pending" }
    return { ok: true, info: JSON.stringify(data ?? {}) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "请求失败 / request failed" };
  }
}
