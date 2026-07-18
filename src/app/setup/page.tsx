import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { SetupForm } from "@/components/setup-form";

export default async function SetupPage() {
  const userCount = await prisma.user.count();
  if (userCount > 0) redirect("/login");

  const { dict } = await getI18n();

  return (
    <AuthShell title={dict.auth.initTitle} subtitle={dict.auth.initSubtitle}>
      <SetupForm />
    </AuthShell>
  );
}
