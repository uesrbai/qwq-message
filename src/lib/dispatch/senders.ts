import "server-only";
import { createHmac } from "crypto";
import {
  type ChannelConfig,
  type DispatchPayload,
  type SendResult,
  renderTemplate,
  mergedVars,
} from "./types";
import { sendSmtp } from "./providers/smtp";
import { sendZeaburEmail } from "./providers/zeabur";
import { sendAliyunSms } from "./providers/aliyun-sms";
import { sendTencentSms } from "./providers/tencent-sms";
import { sendVolcSms } from "./providers/volc-sms";
import { sendWechatMp } from "./providers/wechat-mp";
import { sendWecom } from "./providers/wecom";

export type { ChannelConfig, DispatchPayload, SendResult } from "./types";
export { renderTemplate } from "./types";

// ---------- 自定义 Webhook ----------
async function sendWebhook(config: ChannelConfig, payload: DispatchPayload): Promise<SendResult> {
  const url = config.url;
  if (!url) return { ok: false, error: "缺少 Webhook 地址 / Missing webhook URL" };
  const method = (config.method || "POST").toUpperCase();
  const vars = mergedVars(payload);

  const body =
    config.bodyTemplate && config.bodyTemplate.trim()
      ? renderTemplate(config.bodyTemplate, vars)
      : JSON.stringify({
          to: payload.to,
          subject: payload.subject,
          content: payload.content,
          ...(payload.variables ?? {}),
        });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.headers) {
    try {
      Object.assign(headers, JSON.parse(config.headers));
    } catch {
      return { ok: false, error: "自定义请求头不是合法 JSON / Invalid headers JSON" };
    }
  }
  if (config.secret) {
    headers["X-Signature"] = createHmac("sha256", config.secret).update(body).digest("hex");
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : body,
      cache: "no-store",
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, info: text.slice(0, 500) };
    return { ok: true, info: `HTTP ${res.status} ${text.slice(0, 300)}`.trim() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "请求失败 / request failed" };
  }
}

// ---------- 飞书自定义机器人 ----------
async function sendFeishu(config: ChannelConfig, payload: DispatchPayload): Promise<SendResult> {
  const url = config.webhook;
  if (!url) return { ok: false, error: "缺少飞书 Webhook / Missing Feishu webhook" };
  const body: Record<string, unknown> = { msg_type: "text", content: { text: payload.content } };
  if (config.secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = createHmac("sha256", `${timestamp}\n${config.secret}`).update("").digest("base64");
    body.timestamp = timestamp;
    body.sign = sign;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as { code?: number; msg?: string } | null;
    if (data && typeof data.code === "number" && data.code !== 0) {
      return { ok: false, error: data.msg || `code ${data.code}` };
    }
    return { ok: true, info: JSON.stringify(data ?? {}) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "请求失败 / request failed" };
  }
}

// ---------- 钉钉自定义机器人 ----------
async function sendDingtalk(config: ChannelConfig, payload: DispatchPayload): Promise<SendResult> {
  let url = config.webhook;
  if (!url) return { ok: false, error: "缺少钉钉 Webhook / Missing DingTalk webhook" };
  if (config.secret) {
    const timestamp = Date.now().toString();
    const sign = encodeURIComponent(
      createHmac("sha256", config.secret).update(`${timestamp}\n${config.secret}`).digest("base64"),
    );
    url += (url.includes("?") ? "&" : "?") + `timestamp=${timestamp}&sign=${sign}`;
  }
  const body = JSON.stringify({ msgtype: "text", text: { content: payload.content } });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as { errcode?: number; errmsg?: string } | null;
    if (data && typeof data.errcode === "number" && data.errcode !== 0) {
      return { ok: false, error: data.errmsg || `errcode ${data.errcode}` };
    }
    return { ok: true, info: JSON.stringify(data ?? {}) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "请求失败 / request failed" };
  }
}

export const SENDERS: Record<string, (config: ChannelConfig, payload: DispatchPayload) => Promise<SendResult>> = {
  WEBHOOK: sendWebhook,
  FEISHU: sendFeishu,
  DINGTALK: sendDingtalk,
  SMTP: sendSmtp,
  ZEABUR_EMAIL: sendZeaburEmail,
  ALIYUN: sendAliyunSms,
  TENCENT: sendTencentSms,
  VOLC: sendVolcSms,
  WECHAT_MP: sendWechatMp,
  WECOM: sendWecom,
};

export async function runSender(
  provider: string,
  config: ChannelConfig,
  payload: DispatchPayload,
): Promise<SendResult> {
  const fn = SENDERS[provider];
  if (!fn) return { ok: false, error: `未知渠道类型 ${provider}` };
  return fn(config, payload);
}
