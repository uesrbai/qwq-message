import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { requireFeature } from "@/lib/auth";
import { getSystemConfig } from "@/lib/system-config";
import { PageHeader } from "@/components/page-header";
import { SystemSettingsForm, type SysConfigView } from "@/components/system/system-settings-form";
import {
  SsoBindingsAdmin,
  type SsoBindingRow,
} from "@/components/system/sso-bindings-admin";

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
    ssoClientId: cfg.ssoClientId,
    ssoDefaultRole: cfg.ssoDefaultRole,
    ssoAllowedEmails: cfg.ssoAllowedEmails,
    hasClientSecret: cfg.ssoClientSecret.length > 0,
    hasApiKey: cfg.ssoApiKey.length > 0,
    callbackUrl: `${base}/api/auth/sso/callback`,
  };

  const bindings: SsoBindingRow[] = (
    await prisma.user.findMany({
      where: { ssoSubject: { not: null } },
      orderBy: { createdAt: "asc" },
    })
  ).map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    ssoSubject: u.ssoSubject ?? "",
    hasPassword: !!u.passwordHash,
  }));

  return (
    <>
      <PageHeader title={p.title} description={p.desc} />
      <div className="space-y-6">
        <SystemSettingsForm config={view} />
        <SsoBindingsAdmin rows={bindings} />
      </div>
    </>
  );
}
