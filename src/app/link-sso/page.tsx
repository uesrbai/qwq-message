import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { verifySsoPendingToken, SSO_PENDING_COOKIE } from "@/lib/session";
import { getI18n } from "@/lib/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { LinkSsoForm } from "@/components/link-sso-form";

export default async function LinkSsoPage() {
  const store = await cookies();
  const token = store.get(SSO_PENDING_COOKIE)?.value;
  const pending = token ? await verifySsoPendingToken(token) : null;
  // 没有待绑定信息（未走 SSO 或已过期）→ 回登录页
  if (!pending) redirect("/login");

  // 已登录用户直接走绑定页会造成混淆，让其回首页
  const session = await getSession();
  if (session) redirect("/settings");

  const { dict } = await getI18n();
  const ssoLabel = pending.name || pending.email || pending.sub;

  return (
    <AuthShell title={dict.linkSso.title} subtitle={dict.linkSso.subtitle}>
      <LinkSsoForm ssoLabel={ssoLabel} ssoEmail={pending.email} />
    </AuthShell>
  );
}
