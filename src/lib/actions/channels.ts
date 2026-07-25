"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logOperation } from "@/lib/audit";
import { canUseMethod, canAccessFeature } from "@/lib/permissions";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { METHOD_KEYS, PROVIDER_FIELDS, type MethodKey } from "@/lib/constants";
import { listVolcSecondTemplates, type VolcSecondTemplate } from "@/lib/dispatch/providers/volc-sms";

export type FormState = { ok?: boolean; error?: string } | undefined;

export type VolcTemplateQuery = {
  ok: boolean;
  error?: string;
  templates?: VolcSecondTemplate[];
};

/** 火山引擎「二级模板（子模板）」查询：优先用传入凭证，缺失则回落已保存渠道 */
export async function queryVolcTemplatesAction(input: {
  channelId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
}): Promise<VolcTemplateQuery> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).channels;
  if (!canAccessFeature(user, "channels") || !canUseMethod(user, "SMS")) {
    return { ok: false, error: t.errNoPermission };
  }

  let creds = {
    accessKeyId: (input.accessKeyId ?? "").trim(),
    secretAccessKey: (input.secretAccessKey ?? "").trim(),
    region: (input.region ?? "").trim() || undefined,
  };
  // 表单没填全（如编辑时密钥被隐藏）→ 回落到已保存渠道的凭证
  if ((!creds.accessKeyId || !creds.secretAccessKey) && input.channelId) {
    const ch = await prisma.channel.findUnique({ where: { id: input.channelId } });
    if (ch?.provider === "VOLC") {
      try {
        const saved = JSON.parse(ch.config || "{}") as Record<string, string>;
        creds = {
          accessKeyId: saved.accessKeyId ?? "",
          secretAccessKey: saved.secretAccessKey ?? "",
          region: saved.region || undefined,
        };
      } catch {
        /* ignore */
      }
    }
  }
  return listVolcSecondTemplates(creds);
}

function str(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}

export type ImportTemplateInput = {
  templateId: string; // S1T 一级模板ID（发送用，存 providerTemplateId）
  sign?: string;
  content?: string;
  variables?: string[];
  name?: string;
};

export type ImportResult = { ok: boolean; error?: string; created?: number; skipped?: number };

/** 把火山查询到的模板一键添加为平台 SMS 模板 */
export async function importVolcTemplatesAction(items: ImportTemplateInput[]): Promise<ImportResult> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).channels;
  if (!canAccessFeature(user, "templates")) return { ok: false, error: t.importNoPerm };
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: t.importNone };

  let created = 0;
  let skipped = 0;
  for (const it of items) {
    const providerTemplateId = (it.templateId || "").trim();
    if (!providerTemplateId) {
      skipped++;
      continue;
    }
    // 已按同一个服务商模板ID导入过 → 跳过，避免重复
    const dup = await prisma.template.findFirst({ where: { providerTemplateId } });
    if (dup) {
      skipped++;
      continue;
    }
    // 生成唯一 code：用 S1T 尾段，冲突则追加序号
    const base = `sms_${providerTemplateId.replace(/^S1T_/i, "").slice(0, 12)}`.toLowerCase();
    let code = base;
    for (let i = 2; await prisma.template.findUnique({ where: { code } }); i++) {
      code = `${base}_${i}`;
    }
    const content = (it.content || "").trim();
    const name = (it.name || "").trim() || content.slice(0, 20) || code;
    const variables = Array.isArray(it.variables) ? it.variables.filter(Boolean) : [];

    await prisma.template.create({
      data: {
        code,
        name,
        method: "SMS",
        content,
        signName: (it.sign || "").trim() || null,
        providerTemplateId,
        variables: JSON.stringify(variables),
        enabled: true,
      },
    });
    created++;
  }

  await logOperation(user, "template.create", `火山导入 ${created} 个模板`);
  revalidatePath("/templates");
  return { ok: true, created, skipped };
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
