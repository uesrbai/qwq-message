import "server-only";
import { createHash, createHmac } from "crypto";
import type { ChannelConfig, DispatchPayload, SendResult } from "../types";

// 腾讯云短信 SendSms（TC3-HMAC-SHA256 签名，v2021-01-11）

function sha256hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

export async function sendTencentSms(config: ChannelConfig, payload: DispatchPayload): Promise<SendResult> {
  const { secretId, secretKey, sdkAppId, signName, region } = config;
  if (!secretId || !secretKey || !sdkAppId || !signName) {
    return { ok: false, error: "腾讯云短信配置不完整 / incomplete config" };
  }
  if (!payload.to) return { ok: false, error: "缺少接收手机号 / missing phone" };
  if (!payload.templateCode) return { ok: false, error: "缺少短信模板 ID(TemplateId)" };

  const host = "sms.tencentcloudapi.com";
  const service = "sms";
  const action = "SendSms";
  const version = "2021-01-11";
  const phone = payload.to.startsWith("+") ? payload.to : `+86${payload.to}`;
  const paramSet = payload.variables ? Object.values(payload.variables).map(String) : [];

  const body = JSON.stringify({
    PhoneNumberSet: [phone],
    SmsSdkAppId: sdkAppId,
    SignName: signName,
    TemplateId: payload.templateCode,
    TemplateParamSet: paramSet,
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const ct = "application/json; charset=utf-8";
  const signedHeaders = "content-type;host";
  const canonicalHeaders = `content-type:${ct}\nhost:${host}\n`;
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256hex(body)}`;
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256hex(canonicalRequest)}`;

  const secretDate = hmac(`TC3${secretKey}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = createHmac("sha256", secretSigning).update(stringToSign, "utf8").digest("hex");
  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const res = await fetch(`https://${host}`, {
      method: "POST",
      headers: {
        "Content-Type": ct,
        Host: host,
        Authorization: authorization,
        "X-TC-Action": action,
        "X-TC-Timestamp": String(timestamp),
        "X-TC-Version": version,
        "X-TC-Region": region || "ap-guangzhou",
      },
      body,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as {
      Response?: {
        Error?: { Code?: string; Message?: string };
        SendStatusSet?: { Code?: string; Message?: string }[];
      };
    } | null;
    const r = data?.Response;
    if (r?.Error) return { ok: false, error: r.Error.Message || r.Error.Code, info: JSON.stringify(data) };
    const send = r?.SendStatusSet?.[0];
    if (send && send.Code !== "Ok") return { ok: false, error: send.Message || send.Code, info: JSON.stringify(data) };
    return { ok: true, info: JSON.stringify(data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "请求失败 / request failed" };
  }
}
