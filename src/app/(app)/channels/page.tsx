import { prisma } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { requireFeature } from "@/lib/auth";
import { allowedMethods } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { ChannelsView, type GroupDTO } from "@/components/channels/channels-view";

export default async function ChannelsPage() {
  const user = await requireFeature("channels");
  const allowed = allowedMethods(user);
  const { dict } = await getI18n();
  const p = dict.pages.channels;

  const raw = await prisma.channelGroup.findMany({
    where: allowed ? { method: { in: allowed } } : undefined,
    include: { channels: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ method: "asc" }, { createdAt: "asc" }],
  });

  const groups: GroupDTO[] = raw.map((g) => ({
    id: g.id,
    method: g.method,
    code: g.code,
    name: g.name,
    strategy: g.strategy,
    enabled: g.enabled,
    channels: g.channels.map((ch) => ({
      id: ch.id,
      provider: ch.provider,
      name: ch.name,
      config: ch.config,
      enabled: ch.enabled,
      weight: ch.weight,
      rateLimitPerMin: ch.rateLimitPerMin,
    })),
  }));

  return (
    <>
      <PageHeader title={p.title} description={p.desc} />
      <ChannelsView groups={groups} allowedMethods={allowed} />
    </>
  );
}
