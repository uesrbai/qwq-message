import type { Locale } from "./i18n/config";

// 全站通用常量：分发方式、服务商、策略、角色等
// （SQLite 不支持数据库枚举，所以统一在这里用字符串常量约束）

/** 双语文本 */
export type Bi = { zh: string; en: string };
export function pick(v: Bi, locale: Locale): string {
  return v[locale] ?? v.zh;
}

/** 分发方式（大类）——展示名走 i18n 字典 dict.methods */
export const METHODS = {
  WEBHOOK: "Webhook",
  SMS: "短信",
  EMAIL: "邮箱",
  WECHAT_MP: "微信公众号",
  FEISHU: "飞书",
  DINGTALK: "钉钉",
  WECOM: "企业微信",
} as const;
export type MethodKey = keyof typeof METHODS;
export const METHOD_KEYS = Object.keys(METHODS) as MethodKey[];

/** 每种分发方式下可选的服务商（渠道类型） */
export const PROVIDERS: Record<MethodKey, { key: string; label: Bi }[]> = {
  WEBHOOK: [{ key: "WEBHOOK", label: { zh: "自定义 Webhook", en: "Custom Webhook" } }],
  SMS: [
    { key: "VOLC", label: { zh: "火山引擎", en: "Volcengine" } },
    { key: "ALIYUN", label: { zh: "阿里云", en: "Alibaba Cloud" } },
    { key: "TENCENT", label: { zh: "腾讯云", en: "Tencent Cloud" } },
  ],
  EMAIL: [
    { key: "SMTP", label: { zh: "SMTP", en: "SMTP" } },
    { key: "ZEABUR_EMAIL", label: { zh: "Zeabur Email API", en: "Zeabur Email API" } },
  ],
  WECHAT_MP: [{ key: "WECHAT_MP", label: { zh: "微信公众号", en: "WeChat Official Account" } }],
  FEISHU: [{ key: "FEISHU", label: { zh: "飞书自定义机器人", en: "Feishu Custom Bot" } }],
  DINGTALK: [{ key: "DINGTALK", label: { zh: "钉钉自定义机器人", en: "DingTalk Custom Bot" } }],
  WECOM: [{ key: "WECOM", label: { zh: "企业微信群机器人", en: "WeCom Group Bot" } }],
};

export function providersOfMethod(method: MethodKey) {
  return PROVIDERS[method] ?? [];
}

export function providerLabel(provider: string, locale: Locale): string {
  for (const m of METHOD_KEYS) {
    const found = PROVIDERS[m].find((p) => p.key === provider);
    if (found) return pick(found.label, locale);
  }
  return provider;
}

/** 分组内的渠道调度策略——展示名走 dict.strategies */
export const STRATEGIES = { ROUND_ROBIN: "轮询", LEAST_USED: "调用最少" } as const;
export type StrategyKey = keyof typeof STRATEGIES;
export const STRATEGY_KEYS = Object.keys(STRATEGIES) as StrategyKey[];

/** 用户角色——展示名走 dict.roles */
export const ROLES = { OWNER: "拥有者", ADMIN: "管理员", IAM: "子账号" } as const;
export type RoleKey = keyof typeof ROLES;

/** 密钥类型——展示名走 dict.keyTypes */
export const KEY_TYPES = { TEST: "测试密钥", PRODUCTION: "生产密钥" } as const;
export type KeyTypeKey = keyof typeof KEY_TYPES;

/** 表单字段定义：不同服务商需要填的参数不一样 */
export type FieldDef = {
  key: string;
  label: Bi;
  type?: "text" | "password" | "textarea" | "number";
  placeholder?: string;
  help?: Bi;
  required?: boolean;
};

/** 每个服务商需要配置的字段（渠道配置表单据此动态渲染） */
export const PROVIDER_FIELDS: Record<string, FieldDef[]> = {
  WEBHOOK: [
    { key: "url", label: { zh: "Webhook 地址", en: "Webhook URL" }, placeholder: "https://example.com/hook", required: true },
    { key: "method", label: { zh: "请求方法", en: "HTTP method" }, placeholder: "POST" },
    { key: "headers", label: { zh: "自定义请求头 (JSON)", en: "Custom headers (JSON)" }, type: "textarea", placeholder: '{"Authorization":"Bearer xxx"}' },
    { key: "bodyTemplate", label: { zh: "请求体模板 (可选)", en: "Body template (optional)" }, type: "textarea", help: { zh: "留空则直接发送内容；可用 {{变量}} 占位", en: "Leave blank to send content as-is; supports {{variable}} placeholders" } },
    { key: "secret", label: { zh: "签名密钥 (可选)", en: "Signing secret (optional)" }, type: "password" },
  ],
  VOLC: [
    { key: "accessKeyId", label: { zh: "AccessKeyId", en: "AccessKeyId" }, required: true },
    { key: "secretAccessKey", label: { zh: "SecretAccessKey", en: "SecretAccessKey" }, type: "password", required: true },
    { key: "smsAccount", label: { zh: "短信账号 SMSAccount", en: "SMSAccount" }, required: true },
    { key: "sign", label: { zh: "短信签名", en: "SMS signature" }, required: true },
    { key: "region", label: { zh: "区域", en: "Region" }, placeholder: "cn-north-1" },
  ],
  ALIYUN: [
    { key: "accessKeyId", label: { zh: "AccessKeyId", en: "AccessKeyId" }, required: true },
    { key: "accessKeySecret", label: { zh: "AccessKeySecret", en: "AccessKeySecret" }, type: "password", required: true },
    { key: "signName", label: { zh: "短信签名", en: "SMS signature" }, required: true },
    { key: "region", label: { zh: "区域", en: "Region" }, placeholder: "cn-hangzhou" },
  ],
  TENCENT: [
    { key: "secretId", label: { zh: "SecretId", en: "SecretId" }, required: true },
    { key: "secretKey", label: { zh: "SecretKey", en: "SecretKey" }, type: "password", required: true },
    { key: "sdkAppId", label: { zh: "短信应用 SdkAppId", en: "SMS SdkAppId" }, required: true },
    { key: "signName", label: { zh: "短信签名", en: "SMS signature" }, required: true },
    { key: "region", label: { zh: "区域", en: "Region" }, placeholder: "ap-guangzhou" },
  ],
  SMTP: [
    { key: "host", label: { zh: "SMTP 服务器", en: "SMTP host" }, placeholder: "smtp.example.com", required: true },
    { key: "port", label: { zh: "端口", en: "Port" }, type: "number", placeholder: "465", required: true },
    { key: "secure", label: { zh: "使用 SSL", en: "Use SSL" }, placeholder: "true / false" },
    { key: "user", label: { zh: "账号", en: "Username" }, required: true },
    { key: "pass", label: { zh: "密码 / 授权码", en: "Password / app key" }, type: "password", required: true },
    { key: "from", label: { zh: "发件人", en: "From" }, placeholder: "Notify <no-reply@example.com>", required: true },
  ],
  ZEABUR_EMAIL: [
    { key: "apiKey", label: { zh: "Zeabur API Key", en: "Zeabur API Key" }, type: "password", required: true },
    { key: "from", label: { zh: "发件人地址", en: "From address" }, placeholder: "no-reply@example.com", required: true },
    { key: "endpoint", label: { zh: "接口地址 (可选，留空用默认)", en: "API endpoint (optional)" }, placeholder: "https://mail.zeabur.app/api/send" },
  ],
  WECHAT_MP: [
    { key: "appId", label: { zh: "AppID", en: "AppID" }, required: true },
    { key: "appSecret", label: { zh: "AppSecret", en: "AppSecret" }, type: "password", required: true },
    { key: "templateId", label: { zh: "默认模板消息ID (可选)", en: "Default template message ID (optional)" } },
  ],
  FEISHU: [
    { key: "webhook", label: { zh: "机器人 Webhook 地址", en: "Bot webhook URL" }, required: true },
    { key: "secret", label: { zh: "签名校验密钥 (可选)", en: "Signing secret (optional)" }, type: "password" },
  ],
  DINGTALK: [
    { key: "webhook", label: { zh: "机器人 Webhook 地址", en: "Bot webhook URL" }, required: true },
    { key: "secret", label: { zh: "加签密钥 (可选)", en: "Signing secret (optional)" }, type: "password" },
  ],
  WECOM: [
    { key: "webhook", label: { zh: "机器人 Webhook 地址", en: "Bot webhook URL" }, required: true },
    { key: "msgtype", label: { zh: "消息类型 (text / markdown)", en: "Message type (text / markdown)" }, placeholder: "text" },
  ],
};

/** 取某个 provider 属于哪个 method（用于校验） */
export function methodOfProvider(provider: string): MethodKey | null {
  for (const m of METHOD_KEYS) {
    if (PROVIDERS[m].some((p) => p.key === provider)) return m;
  }
  return null;
}
