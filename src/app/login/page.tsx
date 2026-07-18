import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;

  const userCount = await prisma.user.count();
  if (userCount === 0) redirect("/setup");

  const session = await getSession();
  if (session) redirect("/");

  const { dict } = await getI18n();
  const ssoEnabled = Boolean(process.env.QWQ_SSO_BASE_URL && process.env.QWQ_SSO_API_KEY);

  return (
    <AuthShell title={dict.auth.welcomeBack} subtitle={dict.auth.loginSubtitle}>
      <LoginForm next={sp.next ?? "/"} ssoEnabled={ssoEnabled} error={sp.error} />
    </AuthShell>
  );
}
