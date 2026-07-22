import { prisma } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { requireUser } from "@/lib/auth";
import { isSsoEnabled } from "@/lib/sso";
import { PageHeader } from "@/components/page-header";
import { ChangePassword } from "@/components/settings/change-password";
import { SsoBind } from "@/components/settings/sso-bind";
import { IamManager, type IamDTO } from "@/components/settings/iam-manager";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ bound?: string }>;
}) {
  const user = await requireUser();
  const { dict } = await getI18n();
  const p = dict.pages.settings;
  const isManager = user.role !== "IAM";
  const sp = await searchParams;
  const ssoOn = await isSsoEnabled();

  const accounts: IamDTO[] = isManager
    ? (
        await prisma.user.findMany({
          where: { parentId: user.id, role: "IAM" },
          orderBy: { createdAt: "desc" },
        })
      ).map((a) => ({
        id: a.id,
        username: a.username,
        displayName: a.displayName,
        status: a.status,
        permissions: a.permissions,
      }))
    : [];

  return (
    <>
      <PageHeader title={p.title} description={p.desc} />
      <div className="space-y-6">
        <ChangePassword hasPassword={!!user.passwordHash} />
        <SsoBind bound={!!user.ssoSubject} ssoEnabled={ssoOn} justBound={sp.bound === "1"} />
        {isManager && <IamManager accounts={accounts} />}
      </div>
    </>
  );
}
