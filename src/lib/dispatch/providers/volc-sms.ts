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

// 通用：火山引擎 OpenAPI 签名请求（Signature V4）
type VolcCreds = { accessKeyId: string; secretAccessKey: string; region?: string };

async function volcRequest(
  creds: VolcCreds,
  action: string,
  version: string,
  method: "GET" | "POST",
  body: string,
): Promise<Response> {
  const host = "sms.volcengineapi.com";
  const service = "volcSMS";
  const reg = creds.region || "cn-north-1";

  const xDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const shortDate = xDate.slice(0, 8);
  const payloadHash = sha256hex(body);
  const canonicalQuery = `Action=${action}&Version=${version}`;
  const canonicalHeaders = `host:${host}\nx-content-sha256:${payloadHash}\nx-date:${xDate}\n`;
  const signedHeaders = "host;x-content-sha256;x-date";
  const canonicalRequest = `${method}\n/\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${shortDate}/${reg}/${service}/request`;
  const stringToSign = `HMAC-SHA256\n${xDate}\n${credentialScope}\n${sha256hex(canonicalRequest)}`;

  const kDate = hmac(creds.secretAccessKey, shortDate);
  const kRegion = hmac(kDate, reg);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  const authorization = `HMAC-SHA256 Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    Host: host,
    "X-Date": xDate,
    "X-Content-Sha256": payloadHash,
    Authorization: authorization,
  };
  if (method === "POST") headers["Content-Type"] = "application/json; charset=utf-8";

  return fetch(`https://${host}/?${canonicalQuery}`, {
    method,
    headers,
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
}

export type VolcSecondTemplate = {
  secondTemplateId: string; // 二级模板ID（S2T_...，发送时用的 TemplateID）
  templateId: string; // 一级模板ID（S1T_...）
  sign: string; // 签名
  content: string; // 正文
  channelType: string; // 短信类型 CN_OTP/CN_NTC/CN_MKT 等
  reviewStatus: number; // 审核状态，3=已通过
  approved: boolean; // reviewStatus === 3
  variables: string[]; // 变量名清单（优先取 templateParams，回落正文解析）
  raw: Record<string, unknown>;
};

/** 查询火山引擎「二级模板（子模板）」列表 —— Action=ListSecondTemplate */
export async function listVolcSecondTemplates(
  creds: VolcCreds,
): Promise<{ ok: boolean; error?: string; templates?: VolcSecondTemplate[] }> {
  if (!creds.accessKeyId || !creds.secretAccessKey) {
    return { ok: false, error: "缺少 AccessKeyId / SecretAccessKey" };
  }
  try {
    const res = await volcRequest(creds, "ListSecondTemplate", "2021-01-11", "GET", "");
    const data = (await res.json().catch(() => null)) as {
      ResponseMetadata?: { Error?: { Code?: string; Message?: string } };
      Result?: { list?: unknown[]; List?: unknown[] };
    } | null;
    const err = data?.ResponseMetadata?.Error;
    if (err) return { ok: false, error: err.Message || err.Code || "查询失败" };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const list = (data?.Result?.list ?? data?.Result?.List ?? []) as Record<string, unknown>[];
    const pick = (o: Record<string, unknown>, keys: string[]): string => {
      for (const k of keys) {
        const v = o[k];
        if (v !== undefined && v !== null && v !== "") return String(v);
      }
      return "";
    };
    const templates: VolcSecondTemplate[] = list.map((o) => {
      const content = pick(o, ["content", "Content", "template", "Template"]);
      // 变量优先取 templateParams[].name，回落正文里的 ${var}
      let variables: string[] = [];
      const params = o.templateParams;
      if (Array.isArray(params)) {
        variables = params
          .map((p) => (p && typeof p === "object" ? String((p as Record<string, unknown>).name ?? "") : ""))
          .filter(Boolean);
      }
      if (variables.length === 0) {
        variables = [...content.matchAll(/\$\{(\w+)\}/g)].map((m) => m[1]);
      }
      variables = Array.from(new Set(variables));
      const reviewStatus = Number(pick(o, ["reviewStatus", "ReviewStatus", "status", "Status"]) || "0");
      return {
        secondTemplateId: pick(o, ["secondTemplateId", "SecondTemplateId"]),
        templateId: pick(o, ["templateId", "TemplateId"]),
        sign: pick(o, ["signature", "Signature", "sign", "Sign"]),
        content,
        channelType: pick(o, ["channelType", "ChannelType"]),
        reviewStatus,
        approved: reviewStatus === 3,
        variables,
        raw: o,
      };
    });
    return { ok: true, templates };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "请求失败 / request failed" };
  }
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
