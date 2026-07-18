import { prisma } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { requireFeature } from "@/lib/auth";
import { allowedMethods } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { TestConsole } from "@/components/test/test-console";

export default async function TestPage() {
  const user = await requireFeature("test");
  const allowed = allowedMethods(user);
  const { dict } = await getI18n();
  const p = dict.pages.test;

  const [channels, templates] = await Promise.all([
    prisma.channel.findMany({
      where: allowed ? { group: { method: { in: allowed } } } : undefined,
      include: { group: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.template.findMany({
      where: allowed ? { method: { in: allowed }, enabled: true } : { enabled: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const opts = channels.map((c) => ({
    id: c.id,
    name: c.name,
    provider: c.provider,
    groupName: c.group.name,
  }));

  const tplOpts = templates.map((t) => ({
    code: t.code,
    name: t.name,
    method: t.method,
    variables: t.variables,
    content: t.content,
  }));

  return (
    <>
      <PageHeader title={p.title} description={p.desc} />
      <TestConsole channels={opts} templates={tplOpts} />
    </>
  );
}
