"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logOperation } from "@/lib/audit";
import { canAccessFeature } from "@/lib/permissions";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export type FolderKind = "GROUP" | "TEMPLATE" | "CHANNEL";
export type FolderResult = { ok?: boolean; error?: string; id?: string };

// 每种归类对象对应的功能权限与页面路径
const KIND_META: Record<FolderKind, { feature: string; path: string }> = {
  GROUP: { feature: "channels", path: "/channels" },
  CHANNEL: { feature: "channels", path: "/channels" },
  TEMPLATE: { feature: "templates", path: "/templates" },
};

function isKind(v: string): v is FolderKind {
  return v === "GROUP" || v === "TEMPLATE" || v === "CHANNEL";
}

/** 给某个归类对象设置 folderId（null 表示移出文件夹） */
async function setItemFolder(kind: FolderKind, itemId: string, folderId: string | null) {
  if (kind === "GROUP") {
    await prisma.channelGroup.update({ where: { id: itemId }, data: { folderId } });
  } else if (kind === "TEMPLATE") {
    await prisma.template.update({ where: { id: itemId }, data: { folderId } });
  } else {
    await prisma.channel.update({ where: { id: itemId }, data: { folderId } });
  }
}

export async function createFolderAction(kind: string, name: string): Promise<FolderResult> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).folders;
  if (!isKind(kind)) return { error: t.errKind };
  if (!canAccessFeature(user, KIND_META[kind].feature)) return { error: t.errNoPerm };
  const trimmed = name.trim();
  if (!trimmed) return { error: t.errName };

  const f = await prisma.folder.create({ data: { kind, name: trimmed } });
  await logOperation(user, "folder.create", `${kind}:${trimmed}`);
  revalidatePath(KIND_META[kind].path);
  return { ok: true, id: f.id };
}

export async function renameFolderAction(id: string, name: string): Promise<FolderResult> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).folders;
  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder || !isKind(folder.kind)) return { error: t.errKind };
  if (!canAccessFeature(user, KIND_META[folder.kind].feature)) return { error: t.errNoPerm };
  const trimmed = name.trim();
  if (!trimmed) return { error: t.errName };

  await prisma.folder.update({ where: { id }, data: { name: trimmed } });
  await logOperation(user, "folder.update", `${folder.kind}:${trimmed}`);
  revalidatePath(KIND_META[folder.kind].path);
  return { ok: true };
}

/** 删除文件夹：把其中的项移出到「未分类」，仅删文件夹本身，不删项 */
export async function deleteFolderAction(id: string): Promise<FolderResult> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).folders;
  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder || !isKind(folder.kind)) return { error: t.errKind };
  const kind = folder.kind;
  if (!canAccessFeature(user, KIND_META[kind].feature)) return { error: t.errNoPerm };

  if (kind === "GROUP") {
    await prisma.channelGroup.updateMany({ where: { folderId: id }, data: { folderId: null } });
  } else if (kind === "TEMPLATE") {
    await prisma.template.updateMany({ where: { folderId: id }, data: { folderId: null } });
  } else {
    await prisma.channel.updateMany({ where: { folderId: id }, data: { folderId: null } });
  }
  await prisma.folder.delete({ where: { id } });
  await logOperation(user, "folder.delete", `${kind}:${folder.name}`);
  revalidatePath(KIND_META[kind].path);
  return { ok: true };
}

/** 把某个项移动到某文件夹（folderId 空字符串/undefined = 移出到未分类） */
export async function moveToFolderAction(
  kind: string,
  itemId: string,
  folderId?: string,
): Promise<FolderResult> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).folders;
  if (!isKind(kind)) return { error: t.errKind };
  if (!canAccessFeature(user, KIND_META[kind].feature)) return { error: t.errNoPerm };
  if (!itemId) return { error: t.errKind };

  const target = folderId ? await prisma.folder.findUnique({ where: { id: folderId } }) : null;
  if (folderId && (!target || target.kind !== kind)) return { error: t.errKind };

  await setItemFolder(kind, itemId, folderId || null);
  revalidatePath(KIND_META[kind].path);
  return { ok: true };
}
