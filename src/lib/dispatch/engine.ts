import "server-only";
import { prisma } from "@/lib/db";
import { methodOfProvider } from "@/lib/constants";
import { runSender } from "./senders";
import { renderTemplate, type DispatchPayload, type SendResult } from "./types";

type ChannelLike = { id: string; provider: string; config: string };

type DispatchCtx = {
  source?: string;
  groupCode?: string;
  templateCode?: string;
  apiKeyId?: string;
  requestIp?: string;
};

export type DispatchOutcome = {
  ok: boolean;
  error?: string;
  info?: string;
  channelId?: string;
  method?: string;
  status?: number;
};

/** 通过指定渠道发送，并记录用量与日志 */
export async function sendViaChannel(
  channel: ChannelLike,
  payload: DispatchPayload,
  ctx: DispatchCtx = {},
): Promise<SendResult & { channelId: string }> {
  let config: Record<string, string> = {};
  try {
    config = JSON.parse(channel.config || "{}");
  } catch {
    config = {};
  }

  const started = Date.now();
  const result = await runSender(channel.provider, config, payload);
  const latencyMs = Date.now() - started;
  const method = methodOfProvider(channel.provider) ?? "WEBHOOK";

  await prisma.channel
    .update({
      where: { id: channel.id },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    })
    .catch(() => {});

  await prisma.callLog
    .create({
      data: {
        method,
        channelId: channel.id,
        groupCode: ctx.groupCode ?? null,
        templateCode: ctx.templateCode ?? null,
        source: ctx.source ?? "TEST",
        status: result.ok ? "SUCCESS" : "FAILED",
        errorMsg: result.ok ? null : (result.error ?? "failed").slice(0, 500),
        latencyMs,
        requestIp: ctx.requestIp ?? null,
        apiKeyId: ctx.apiKeyId ?? null,
      },
    })
    .catch(() => {});

  return { ...result, channelId: channel.id };
}

/** 按分组策略给出「尝试顺序」的可用渠道列表（用于容灾：失败自动换下一个） */
export async function selectChannelsForGroup(groupId: string) {
  const group = await prisma.channelGroup.findUnique({
    where: { id: groupId },
    include: { channels: { where: { enabled: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!group || group.channels.length === 0) return null;
  const chans = group.channels;

  if (group.strategy === "LEAST_USED") {
    return [...chans].sort((a, b) => a.usageCount - b.usageCount);
  }

  // 加权轮询：从 cursor 起排出不重复的渠道尝试顺序
  const expanded: typeof chans = [];
  for (const ch of chans) {
    for (let i = 0; i < Math.max(1, ch.weight); i++) expanded.push(ch);
  }
  const start = group.rrCursor % expanded.length;
  const seen = new Set<string>();
  const ordered: typeof chans = [];
  for (let i = 0; i < expanded.length; i++) {
    const ch = expanded[(start + i) % expanded.length];
    if (!seen.has(ch.id)) {
      seen.add(ch.id);
      ordered.push(ch);
    }
  }
  await prisma.channelGroup
    .update({ where: { id: group.id }, data: { rrCursor: (group.rrCursor + 1) % 1_000_000 } })
    .catch(() => {});
  return ordered;
}

/** 该渠道这一分钟内是否已达发送上限 */
async function isRateLimited(channel: { id: string; rateLimitPerMin: number | null }) {
  if (!channel.rateLimitPerMin || channel.rateLimitPerMin <= 0) return false;
  const since = new Date(Date.now() - 60_000);
  const count = await prisma.callLog.count({
    where: { channelId: channel.id, createdAt: { gte: since } },
  });
  return count >= channel.rateLimitPerMin;
}

/** 向一个分组分发：按顺序尝试渠道，失败或限速自动换下一个，直到成功或全部失败 */
async function dispatchToGroup(
  group: { id: string; code: string; method: string },
  payload: DispatchPayload,
  ctx: DispatchCtx,
): Promise<DispatchOutcome> {
  const channels = await selectChannelsForGroup(group.id);
  if (!channels || channels.length === 0) {
    return { ok: false, error: `分组无可用渠道: ${group.code}`, status: 400 };
  }

  const errors: string[] = [];
  let last: (SendResult & { channelId: string }) | undefined;

  for (const channel of channels) {
    // 超出该渠道限速就跳过，交给同组下一个
    if (await isRateLimited(channel)) {
      errors.push(`${channel.name}: 已达限速 ${channel.rateLimitPerMin}/分钟，已跳过`);
      continue;
    }
    const r = await sendViaChannel(channel, payload, { ...ctx, groupCode: group.code });
    if (r.ok) {
      const attempt = errors.length + 1;
      return {
        ok: true,
        info: attempt > 1 ? `第 ${attempt} 个渠道发送成功。${r.info ?? ""}`.trim() : r.info,
        channelId: r.channelId,
        method: group.method,
        status: 200,
      };
    }
    errors.push(`${channel.name}: ${r.error ?? "failed"}`);
    last = r;
  }

  return {
    ok: false,
    error: `全部 ${channels.length} 个渠道均失败 → ${errors.join(" | ")}`.slice(0, 500),
    info: last?.info,
    channelId: last?.channelId,
    method: group.method,
    status: 502,
  };
}

/** 按分组编号分发（公开接口用） */
export async function dispatchByGroupCode(
  groupCode: string,
  payload: DispatchPayload,
  ctx: DispatchCtx = {},
): Promise<DispatchOutcome> {
  const group = await prisma.channelGroup.findUnique({ where: { code: groupCode } });
  if (!group) return { ok: false, error: `分组不存在: ${groupCode}`, status: 404 };
  if (!group.enabled) return { ok: false, error: `分组已停用: ${groupCode}`, status: 400 };
  return dispatchToGroup(group, payload, ctx);
}

/** 按模板编号分发（公开接口用） */
export async function dispatchByTemplateCode(
  templateCode: string,
  payload: DispatchPayload,
  ctx: DispatchCtx = {},
): Promise<DispatchOutcome> {
  const tpl = await prisma.template.findUnique({ where: { code: templateCode } });
  if (!tpl || !tpl.enabled) return { ok: false, error: `模板不存在或已停用: ${templateCode}`, status: 404 };

  let group = tpl.groupId
    ? await prisma.channelGroup.findUnique({ where: { id: tpl.groupId } })
    : null;
  if (!group) group = await prisma.channelGroup.findFirst({ where: { method: tpl.method, enabled: true } });
  if (!group) return { ok: false, error: `模板「${templateCode}」无可用分组`, status: 400 };
  if (!group.enabled) return { ok: false, error: `分组已停用: ${group.code}`, status: 400 };

  const content = tpl.content ? renderTemplate(tpl.content, payload.variables ?? {}) : payload.content;
  const finalPayload: DispatchPayload = {
    ...payload,
    content: content || payload.content,
    subject: payload.subject ?? tpl.subject ?? undefined,
    templateCode: tpl.providerTemplateId ?? payload.templateCode,
  };

  return dispatchToGroup(group, finalPayload, { ...ctx, templateCode: tpl.code });
}
