"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logOperation } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/hash";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { IAM_FEATURES } from "@/lib/permissions";
import { METHOD_KEYS, type MethodKey } from "@/lib/constants";

export type FormState = { ok?: boolean; error?: string } | undefined;

// ---------- 修改自己的密码 ----------
export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).settings;

  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  if (next.length < 6) return { error: t.errPwdShort };
  if (next !== confirm) return { error: t.errPwdMismatch };
  if (user.passwordHash && !verifyPassword(current, user.passwordHash)) {
    return { error: t.errPwdWrong };
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
  await logOperation(user, "password.change", user.displayName ?? user.username);
  return { ok: true };
}

// ---------- 创建 IAM 子账号 ----------
export async function createIamAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).settings;
  if (user.role === "IAM") return { error: t.errNoPermission };

  const username = String(fd.get("username") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const emailInput = String(fd.get("email") ?? "").trim();
  const featureList = IAM_FEATURES as readonly string[];
  const features = fd.getAll("features").map(String).filter((f) => featureList.includes(f));
  const methods = fd
    .getAll("methods")
    .map(String)
    .filter((m) => METHOD_KEYS.includes(m as MethodKey));

  if (username.length < 2) return { error: t.errUsername };
  if (password.length < 6) return { error: t.errPwdShort };
  if (await prisma.user.findUnique({ where: { username } })) return { error: t.errUserExists };

  let email = emailInput || `iam_${username}@local`;
  if (await prisma.user.findUnique({ where: { email } })) {
    email = `iam_${username}_${Date.now()}@local`;
  }

  await prisma.user.create({
    data: {
      email,
      username,
      displayName: username,
      passwordHash: hashPassword(password),
      role: "IAM",
      parentId: user.id,
      permissions: JSON.stringify({ features, methods }),
    },
  });
  await logOperation(user, "iam.create", username);
  revalidatePath("/settings");
  return { ok: true };
}

// ---------- 修改子账号权限 ----------
export async function updateIamAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).settings;
  if (user.role === "IAM") return { error: t.errNoPermission };

  const id = String(fd.get("id") ?? "");
  const featureList = IAM_FEATURES as readonly string[];
  const features = fd.getAll("features").map(String).filter((f) => featureList.includes(f));
  const methods = fd
    .getAll("methods")
    .map(String)
    .filter((m) => METHOD_KEYS.includes(m as MethodKey));

  const target = await ownSubAccount(user.id, id);
  if (!target) return { error: t.errNoPermission };

  await prisma.user.update({
    where: { id },
    data: { permissions: JSON.stringify({ features, methods }) },
  });
  await logOperation(user, "iam.update", target.username);
  revalidatePath("/settings");
  return { ok: true };
}

// ---------- 子账号：启停 / 删除 / 重置密码 ----------
async function ownSubAccount(parentId: string, id: string) {
  const target = await prisma.user.findUnique({ where: { id } });
  return target && target.parentId === parentId && target.role === "IAM" ? target : null;
}

export async function setUserEnabledAction(fd: FormData) {
  const user = await requireUser();
  if (user.role === "IAM") return;
  const id = String(fd.get("id") ?? "");
  const enabled = String(fd.get("enabled") ?? "") === "true";
  const target = await ownSubAccount(user.id, id);
  if (target) {
    await prisma.user.update({ where: { id }, data: { status: enabled ? "ACTIVE" : "DISABLED" } });
    await logOperation(user, enabled ? "iam.enable" : "iam.disable", target.username);
    revalidatePath("/settings");
  }
}

export async function deleteIamAction(fd: FormData) {
  const user = await requireUser();
  if (user.role === "IAM") return;
  const id = String(fd.get("id") ?? "");
  const target = await ownSubAccount(user.id, id);
  if (target) {
    await prisma.user.delete({ where: { id } });
    await logOperation(user, "iam.delete", target.username);
    revalidatePath("/settings");
  }
}

export async function resetIamPasswordAction(fd: FormData) {
  const user = await requireUser();
  if (user.role === "IAM") return;
  const id = String(fd.get("id") ?? "");
  const password = String(fd.get("password") ?? "");
  const target = await ownSubAccount(user.id, id);
  if (password.length >= 6 && target) {
    await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
    await logOperation(user, "iam.reset", target.username);
    revalidatePath("/settings");
  }
}
