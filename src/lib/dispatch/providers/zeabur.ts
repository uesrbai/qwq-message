import "server-only";
import type { ChannelConfig, DispatchPayload, SendResult } from "../types";

// Zeabur Email API（HTTP）。端点可在渠道配置里用 endpoint 字段覆盖，
// 以对齐 Zeabur 最新文档。
const DEFAULT_ENDPOINT = "https://mail.zeabur.app/api/send";

export async function sendZeaburEmail(config: ChannelConfig, payload: DispatchPayload): Promise<SendResult> {
  const { apiKey, from, endpoint } = config;
  if (!apiKey || !from) return { ok: false, error: "Zeabur 邮件配置不完整 / incomplete config" };
  if (!payload.to) return { ok: false, error: "缺少收件人 / missing recipient" };

  const body = JSON.stringify({
    from,
    to: payload.to,
    subject: payload.subject || "",
    html: payload.content,
    text: payload.content,
  });

  try {
    const res = await fetch(endpoint || DEFAULT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body,
      cache: "no-store",
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, info: text.slice(0, 300) };
    return { ok: true, info: text.slice(0, 300) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "请求失败 / request failed" };
  }
}
