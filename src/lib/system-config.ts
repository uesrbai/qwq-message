import "server-only";
import { getSetting, setSetting } from "./settings";

// 系统级配置：优先读数据库（应用内可改，改完即时生效），回落到环境变量。
// 注意：AUTH_SECRET / DATABASE_URL 是启动依赖，不在此列，仍由环境变量提供。

export type SystemConfig = {
  appUrl: string;
  ssoBaseUrl: string;
  ssoApiKey: string;
  ssoDefaultRole: string;
  ssoAllowedEmails: string;
};

const KEY = "system_config";

function pick(saved: string | undefined, env: string | undefined, fallback = ""): string {
  const s = saved?.trim();
  if (s) return s;
  const e = env?.trim();
  if (e) return e;
  return fallback;
}

export async function getSystemConfig(): Promise<SystemConfig> {
  const saved = await getSetting<Partial<SystemConfig>>(KEY, {});
  return {
    appUrl: pick(saved.appUrl, process.env.APP_URL),
    ssoBaseUrl: pick(saved.ssoBaseUrl, process.env.QWQ_SSO_BASE_URL),
    ssoApiKey: pick(saved.ssoApiKey, process.env.QWQ_SSO_API_KEY),
    ssoDefaultRole: pick(saved.ssoDefaultRole, process.env.QWQ_SSO_DEFAULT_ROLE, "ADMIN"),
    ssoAllowedEmails: pick(saved.ssoAllowedEmails, process.env.QWQ_SSO_ALLOWED_EMAILS),
  };
}

/** 部分更新；空字段保持原值（用于「API Key 留空则不改」这类场景由调用方控制） */
export async function saveSystemConfig(patch: Partial<SystemConfig>): Promise<void> {
  const cur = await getSetting<Partial<SystemConfig>>(KEY, {});
  await setSetting(KEY, { ...cur, ...patch });
}
