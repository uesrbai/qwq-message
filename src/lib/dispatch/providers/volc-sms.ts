import "server-only";
import { createHash, createHmac } from "crypto";
import type { ChannelConfig, DispatchPayload, SendResult } from "../types";

// 火山引擎短信 SendSms（Volcengine Signature V4，HMAC-SHA256）

function sha256hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

export async function sendVolcSms(config: ChannelConfig, payload: DispatchPayload): Promise<SendResult> {
  const { accessKeyId, secretAccessKey, smsAccount, sign, region } = config;
  if (!accessKeyId || !secretAccessKey || !smsAccount || !sign) {
    return { ok: false, error: "火山引擎短信配置不完整 / incomplete config" };
  }
  if (!payload.to) return { ok: false, error: "缺少接收手机号 / missing phone" };
  if (!payload.templateCode) return { ok: false, error: "缺少短信模板 ID(TemplateID)" };

  const host = "sms.volcengineapi.com";
  const service = "volcSMS";
  const reg = region || "cn-north-1";
  const action = "SendSms";
  const version = "2020-01-01";

  const bodyObj: Record<string, string> = {
    SmsAccount: smsAccount,
    Sign: sign,
    TemplateID: payload.templateCode,
    PhoneNumbers: payload.to,
  };
  if (payload.variables && Object.keys(payload.variables).length) {
    bodyObj.TemplateParam = JSON.stringify(payload.variables);
  }
  const body = JSON.stringify(bodyObj);

  const xDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); // YYYYMMDDTHHmmssZ
  const shortDate = xDate.slice(0, 8);
  const payloadHash = sha256hex(body);
  const canonicalQuery = `Action=${action}&Version=${version}`;
  const canonicalHeaders = `host:${host}\nx-content-sha256:${payloadHash}\nx-date:${xDate}\n`;
  const signedHeaders = "host;x-content-sha256;x-date";
  const canonicalRequest = `POST\n/\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${shortDate}/${reg}/${service}/request`;
  const stringToSign = `HMAC-SHA256\n${xDate}\n${credentialScope}\n${sha256hex(canonicalRequest)}`;

  const kDate = hmac(secretAccessKey, shortDate);
  const kRegion = hmac(kDate, reg);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  const authorization = `HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const res = await fetch(`https://${host}/?${canonicalQuery}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Host: host,
        "X-Date": xDate,
        "X-Content-Sha256": payloadHash,
        Authorization: authorization,
      },
      body,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as {
      ResponseMetadata?: { Error?: { Code?: string; Message?: string } };
    } | null;
    const err = data?.ResponseMetadata?.Error;
    if (err) return { ok: false, error: err.Message || err.Code, info: JSON.stringify(data) };
    return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}`, info: JSON.stringify(data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "请求失败 / request failed" };
  }
}
