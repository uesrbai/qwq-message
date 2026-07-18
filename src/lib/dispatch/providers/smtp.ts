import "server-only";
import nodemailer from "nodemailer";
import type { ChannelConfig, DispatchPayload, SendResult } from "../types";

// SMTP 邮件（nodemailer）
export async function sendSmtp(config: ChannelConfig, payload: DispatchPayload): Promise<SendResult> {
  const { host, port, secure, user, pass, from } = config;
  if (!host || !port || !user || !pass || !from) {
    return { ok: false, error: "SMTP 配置不完整 / incomplete SMTP config" };
  }
  if (!payload.to) return { ok: false, error: "缺少收件人 / missing recipient" };

  const portNum = Number(port) || 465;
  const isSecure = secure ? /^(true|1|yes|ssl)$/i.test(secure) : portNum === 465;

  const transport = nodemailer.createTransport({
    host,
    port: portNum,
    secure: isSecure,
    auth: { user, pass },
  });

  try {
    const info = await transport.sendMail({
      from,
      to: payload.to,
      subject: payload.subject || "(no subject)",
      text: payload.content,
      html: payload.content,
    });
    const preview = nodemailer.getTestMessageUrl(info);
    return {
      ok: true,
      info: `messageId: ${info.messageId}${preview ? ` | preview: ${preview}` : ""}`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "发送失败 / send failed" };
  }
}
