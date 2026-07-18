import "server-only";
import type { ChannelConfig, DispatchPayload, SendResult } from "../types";

// 企业微信群机器人。支持 text / markdown，按返回的 errcode 判定成功。
export async function sendWecom(config: ChannelConfig, payload: DispatchPayload): Promise<SendResult> {
  const url = config.webhook;
  if (!url) return { ok: false, error: "缺少企业微信 Webhook / Missing WeCom webhook" };

  const isMarkdown = (config.msgtype || "text").toLowerCase() === "markdown";
  const body = isMarkdown
    ? { msgtype: "markdown", markdown: { content: payload.content } }
    : { msgtype: "text", text: { content: payload.content } };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as { errcode?: number; errmsg?: string } | null;
    if (data && typeof data.errcode === "number" && data.errcode !== 0) {
      return { ok: false, error: data.errmsg || `errcode ${data.errcode}`, info: JSON.stringify(data) };
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, info: JSON.stringify(data) };
    return { ok: true, info: JSON.stringify(data ?? {}) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "请求失败 / request failed" };
  }
}
