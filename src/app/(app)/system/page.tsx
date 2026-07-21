import { headers } from "next/headers";
import { getI18n } from "@/lib/i18n/server";
import { requireFeature } from "@/lib/auth";
import { getSystemConfig } from "@/lib/system-config";
import { PageHeader } from "@/components/page-header";
import { SystemSettingsForm, type SysConfigView } from "@/components/system/system-settings-form";

export default async function SystemPage() {
  await requireFeature("system");
  const { dict } = await getI18n();
  const p = dict.pages.system;
  const cfg = await getSystemConfig();

  // 回调地址：优先用配置里的应用地址，否则用当前请求域名
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = (cfg.appUrl || `${proto}://${host}`).replace(/\/+$/, "");

  const view: SysConfigView = {
    appUrl: cfg.appUrl,
    ssoBaseUrl: cfg.ssoBaseUrl,
    ssoDefaultRole: cfg.ssoDefaultRole,
    ssoAllowedEmails: cfg.ssoAllowedEmails,
    hasApiKey: cfg.ssoApiKey.length > 0,
    callbackUrl: `${base}/api/auth/sso/callback`,
  };

  return (
    <>
      <PageHeader title={p.title} description={p.desc} />
      <SystemSettingsForm config={view} />
    </>
  );
}
