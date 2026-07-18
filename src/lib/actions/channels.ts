"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logOperation } from "@/lib/audit";
import { canUseMethod, canAccessFeature } from "@/lib/permissions";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { METHOD_KEYS, PROVIDER_FIELDS, type MethodKey } from "@/lib/constants";

export type FormState = { ok?: boolean; error?: string } | undefined;

function str(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}

// ---------- 分组 ----------

export async function createGroupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).channels;
  if (!canAccessFeature(user, "channels")) return { error: t.errNoPermission };

  const method = str(fd, "method");
  const name = str(fd, "name");
  const code = str(fd, "code");
  const strategy = str(fd, "strategy") || "ROUND_ROBIN";

  if (!METHOD_KEYS.includes(method as MethodKey)) return { error: t.errRequired };
  if (!canUseMethod(user, method)) return { error: t.errNoPermission };
  if (!name) return { error: t.errName };
  if (!code) return { error: t.errCode };

  if (await prisma.channelGroup.findUnique({ where: { code } })) {
    return { error: t.errCodeExists };
  }

  await prisma.channelGroup.create({ data: { method, name, code, strategy } });
  await logOperation(user, "group.create", `${name} (${code})`);
  revalidatePath("/channels");
  return { ok: true };
}

export async function updateGroupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).channels;
  if (!canAccessFeature(user, "channels")) return { error: t.errNoPermission };

  const id = str(fd, "id");
  const name = str(fd, "name");
  const code = str(fd, "code");
  const strategy = str(fd, "strategy") || "ROUND_ROBIN";

  if (!id) return { error: t.errRequired };
  if (!name) return { error: t.errName };
  if (!code) return { error: t.errCode };

  const existing = await prisma.channelGroup.findUnique({ where: { id } });
  if (!existing) return { error: t.errRequired };
  if (!canUseMethod(user, existing.method)) return { error: t.errNoPermission };

  const other = await prisma.channelGroup.findUnique({ where: { code } });
  if (other && other.id !== id) return { error: t.errCodeExists };

  await prisma.channelGroup.update({ where: { id }, data: { name, code, strategy } });
  await logOperation(user, "group.update", `${name} (${code})`);
  revalidatePath("/channels");
  return { ok: true };
}

export async function deleteGroupAction(fd: FormData) {
  const user = await requireUser();
  if (!canAccessFeature(user, "channels")) return;
  const id = String(fd.get("id") ?? "");
  if (id) {
    const g = await prisma.channelGroup.findUnique({ where: { id } });
    if (!g || !canUseMethod(user, g.method)) return;
    await prisma.channelGroup.delete({ where: { id } });
    await logOperation(user, "group.delete", `${g.name} (${g.code})`);
    revalidatePath("/channels");
  }
}

export async function setGroupEnabledAction(fd: FormData) {
  const user = await requireUser();
  if (!canAccessFeature(user, "channels")) return;
  const id = String(fd.get("id") ?? "");
  const enabled = String(fd.get("enabled") ?? "") === "true";
  if (id) {
    const g = await prisma.channelGroup.findUnique({ where: { id } });
    if (!g || !canUseMethod(user, g.method)) return;
    await prisma.channelGroup.update({ where: { id }, data: { enabled } });
    await logOperation(user, enabled ? "group.enable" : "group.disable", `${g.name} (${g.code})`);
    revalidatePath("/channels");
  }
}

// ---------- 渠道 ----------

function collectConfig(fd: FormData, provider: string, t: { errRequired: string }): Record<string, string> | { error: string } {
  const fields = PROVIDER_FIELDS[provider] ?? [];
  const config: Record<string, string> = {};
  for (const f of fields) {
    const v = str(fd, `cfg_${f.key}`);
    if (f.required && !v) return { error: t.errRequired };
    if (v) config[f.key] = v;
  }
  return config;
}

export async function createChannelAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).channels;
  if (!canAccessFeature(user, "channels")) return { error: t.errNoPermission };

  const groupId = str(fd, "groupId");
  const provider = str(fd, "provider");
  const name = str(fd, "name");
  const weight = Math.max(1, Number(str(fd, "weight") || "1") || 1);
  const rateRaw = str(fd, "rateLimitPerMin");
  const rateLimitPerMin = rateRaw ? Math.max(1, Number(rateRaw) || 0) || null : null;

  if (!groupId || !provider) return { error: t.errRequired };
  if (!name) return { error: t.errName };

  const group = await prisma.channelGroup.findUnique({ where: { id: groupId } });
  if (!group) return { error: t.errRequired };
  if (!canUseMethod(user, group.method)) return { error: t.errNoPermission };

  const config = collectConfig(fd, provider, t);
  if ("error" in config) return { error: config.error };

  await prisma.channel.create({
    data: { groupId, provider, name, weight, rateLimitPerMin, config: JSON.stringify(config) },
  });
  await logOperation(user, "channel.create", name);
  revalidatePath("/channels");
  return { ok: true };
}

export async function updateChannelAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).channels;
  if (!canAccessFeature(user, "channels")) return { error: t.errNoPermission };

  const id = str(fd, "id");
  const provider = str(fd, "provider");
  const name = str(fd, "name");
  const weight = Math.max(1, Number(str(fd, "weight") || "1") || 1);
  const rateRaw = str(fd, "rateLimitPerMin");
  const rateLimitPerMin = rateRaw ? Math.max(1, Number(rateRaw) || 0) || null : null;

  if (!id || !provider) return { error: t.errRequired };
  if (!name) return { error: t.errName };

  const existing = await prisma.channel.findUnique({ where: { id }, include: { group: true } });
  if (!existing) return { error: t.errRequired };
  if (!canUseMethod(user, existing.group.method)) return { error: t.errNoPermission };

  const config = collectConfig(fd, provider, t);
  if ("error" in config) return { error: config.error };

  await prisma.channel.update({
    where: { id },
    data: { name, weight, rateLimitPerMin, config: JSON.stringify(config) },
  });
  await logOperation(user, "channel.update", name);
  revalidatePath("/channels");
  return { ok: true };
}

export async function deleteChannelAction(fd: FormData) {
  const user = await requireUser();
  if (!canAccessFeature(user, "channels")) return;
  const id = String(fd.get("id") ?? "");
  if (id) {
    const ch = await prisma.channel.findUnique({ where: { id }, include: { group: true } });
    if (!ch || !canUseMethod(user, ch.group.method)) return;
    await prisma.channel.delete({ where: { id } });
    await logOperation(user, "channel.delete", ch.name);
    revalidatePath("/channels");
  }
}

export async function setChannelEnabledAction(fd: FormData) {
  const user = await requireUser();
  if (!canAccessFeature(user, "channels")) return;
  const id = String(fd.get("id") ?? "");
  const enabled = String(fd.get("enabled") ?? "") === "true";
  if (id) {
    const ch = await prisma.channel.findUnique({ where: { id }, include: { group: true } });
    if (!ch || !canUseMethod(user, ch.group.method)) return;
    await prisma.channel.update({ where: { id }, data: { enabled } });
    await logOperation(user, enabled ? "channel.enable" : "channel.disable", ch.name);
    revalidatePath("/channels");
  }
}
