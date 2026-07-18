import "server-only";
import { createHmac } from "crypto";
import type { ChannelConfig, DispatchPayload, SendResult } from "../types";

// 阿里云短信 SendSms（RPC 风格，HMAC-SHA1 签名）
// 注：需在阿里云控制台预先申请短信签名与模板；templateCode 为模板 CODE。

function percentEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

export async function sendAliyunSms(config: ChannelConfig, payload: DispatchPayload): Promise<SendResult> {
  const { accessKeyId, accessKeySecret, signName, region } = config;
  if (!accessKeyId || !accessKeySecret || !signName) {
    return { ok: false, error: "阿里云短信配置不完整 / incomplete config" };
  }
  if (!payload.to) return { ok: false, error: "缺少接收手机号 / missing phone" };
  if (!payload.templateCode) return { ok: false, error: "缺少短信模板 CODE(TemplateCode)" };

  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: payload.to,
    RegionId: region || "cn-hangzhou",
    SignName: signName,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: `${Date.now()}${Math.random().toString(36).slice(2)}`,
    SignatureVersion: "1.0",
    TemplateCode: payload.templateCode,
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25",
  };
  if (payload.variables && Object.keys(payload.variables).length) {
    params.TemplateParam = JSON.stringify(payload.variables);
  }

  const canonical = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");
  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonical)}`;
  const signature = createHmac("sha1", `${accessKeySecret}&`).update(stringToSign).digest("base64");
  const url = `https://dysmsapi.aliyuncs.com/?${canonical}&Signature=${percentEncode(signature)}`;

  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const data = (await res.json().catch(() => null)) as { Code?: string; Message?: string } | null;
    if (data?.Code === "OK") return { ok: true, info: JSON.stringify(data) };
    return { ok: false, error: data?.Message || data?.Code || `HTTP ${res.status}`, info: JSON.stringify(data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "请求失败 / request failed" };
  }
}
