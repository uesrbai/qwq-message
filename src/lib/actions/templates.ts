"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logOperation } from "@/lib/audit";
import { canUseMethod, canAccessFeature } from "@/lib/permissions";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { METHOD_KEYS, type MethodKey } from "@/lib/constants";
import { extractTemplateVars } from "@/lib/template-vars";

export type FormState = { ok?: boolean; error?: string } | undefined;

function str(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}
async function readForm(fd: FormData) {
  const content = str(fd, "content");
  const data = {
    code: str(fd, "code"),
    name: str(fd, "name"),
    method: str(fd, "method"),
    groupId: str(fd, "groupId") || null,
    subject: str(fd, "subject") || null,
    content,
    signName: str(fd, "signName") || null,
    providerTemplateId: str(fd, "providerTemplateId") || null,
    // 变量清单直接从正文里的 ${...} / {{...}} 占位自动解析，不再手填
    variables: JSON.stringify(extractTemplateVars(content)),
  };
  // 绑定分组必须与模板分发方式一致，否则忽略该绑定（回退到自动选组）
  if (data.groupId) {
    const g = await prisma.channelGroup.findUnique({ where: { id: data.groupId } });
    if (!g || g.method !== data.method) data.groupId = null;
  }
  return data;
}

export async function createTemplateAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).templates;
  if (!canAccessFeature(user, "templates")) return { error: t.errNoPermission };
  const data = await readForm(fd);

  if (!data.code) return { error: t.errCode };
  if (!data.name) return { error: t.errName };
  if (!METHOD_KEYS.includes(data.method as MethodKey)) return { error: t.errName };
  if (!canUseMethod(user, data.method)) return { error: t.errNoPermission };
  if (await prisma.template.findUnique({ where: { code: data.code } })) {
    return { error: t.errCodeExists };
  }

  await prisma.template.create({ data });
  await logOperation(user, "template.create", `${data.name} (${data.code})`);
  revalidatePath("/templates");
  return { ok: true };
}

export async function updateTemplateAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).templates;
  if (!canAccessFeature(user, "templates")) return { error: t.errNoPermission };
  const id = str(fd, "id");
  const data = await readForm(fd);

  if (!id) return { error: t.errName };
  if (!data.code) return { error: t.errCode };
  if (!data.name) return { error: t.errName };
  if (!canUseMethod(user, data.method)) return { error: t.errNoPermission };

  const existing = await prisma.template.findUnique({ where: { id } });
  if (!existing) return { error: t.errName };
  if (!canUseMethod(user, existing.method)) return { error: t.errNoPermission };

  const other = await prisma.template.findUnique({ where: { code: data.code } });
  if (other && other.id !== id) return { error: t.errCodeExists };

  await prisma.template.update({ where: { id }, data });
  await logOperation(user, "template.update", `${data.name} (${data.code})`);
  revalidatePath("/templates");
  return { ok: true };
}

export async function deleteTemplateAction(fd: FormData) {
  const user = await requireUser();
  if (!canAccessFeature(user, "templates")) return;
  const id = String(fd.get("id") ?? "");
  if (id) {
    const tpl = await prisma.template.findUnique({ where: { id } });
    if (!tpl || !canUseMethod(user, tpl.method)) return;
    await prisma.template.delete({ where: { id } });
    await logOperation(user, "template.delete", `${tpl.name} (${tpl.code})`);
    revalidatePath("/templates");
  }
}

export async function setTemplateEnabledAction(fd: FormData) {
  const user = await requireUser();
  if (!canAccessFeature(user, "templates")) return;
  const id = String(fd.get("id") ?? "");
  const enabled = String(fd.get("enabled") ?? "") === "true";
  if (id) {
    const tpl = await prisma.template.findUnique({ where: { id } });
    if (!tpl || !canUseMethod(user, tpl.method)) return;
    await prisma.template.update({ where: { id }, data: { enabled } });
    await logOperation(user, enabled ? "template.enable" : "template.disable", `${tpl.name} (${tpl.code})`);
    revalidatePath("/templates");
  }
}
