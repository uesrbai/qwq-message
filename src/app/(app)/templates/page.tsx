import { prisma } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { requireFeature } from "@/lib/auth";
import { allowedMethods } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { TemplatesView, type TemplateDTO } from "@/components/templates/templates-view";
import type { GroupOpt } from "@/components/templates/template-dialog";
import type { FolderDTO } from "@/components/folders/folders-ui";

export default async function TemplatesPage() {
  const user = await requireFeature("templates");
  const allowed = allowedMethods(user);
  const { dict } = await getI18n();
  const p = dict.pages.templates;

  const [templates, groups, folderRows] = await Promise.all([
    prisma.template.findMany({
      where: allowed ? { method: { in: allowed } } : undefined,
      include: { group: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.channelGroup.findMany({
      where: allowed ? { method: { in: allowed } } : undefined,
      orderBy: [{ method: "asc" }, { createdAt: "asc" }],
    }),
    prisma.folder.findMany({ where: { kind: "TEMPLATE" }, orderBy: { createdAt: "asc" } }),
  ]);
  const folders: FolderDTO[] = folderRows.map((f) => ({ id: f.id, name: f.name }));

  const tdtos: TemplateDTO[] = templates.map((tpl) => ({
    id: tpl.id,
    code: tpl.code,
    name: tpl.name,
    method: tpl.method,
    groupId: tpl.groupId,
    groupName: tpl.group?.name ?? null,
    subject: tpl.subject,
    content: tpl.content,
    signName: tpl.signName,
    providerTemplateId: tpl.providerTemplateId,
    variables: tpl.variables,
    enabled: tpl.enabled,
    folderId: tpl.folderId,
  }));

  const gopts: GroupOpt[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    method: g.method,
    code: g.code,
  }));

  return (
    <>
      <PageHeader title={p.title} description={p.desc} />
      <TemplatesView templates={tdtos} groups={gopts} allowedMethods={allowed} folders={folders} />
    </>
  );
}
