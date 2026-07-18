"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/hash";
import { setSession, clearSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export type ActionState = { error?: string } | undefined;

/** 首次安装：创建拥有者账号 */
export async function createOwnerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const t = getDictionary(await getLocale()).auth;

  const count = await prisma.user.count();
  if (count > 0) redirect("/login");

  const schema = z.object({
    email: z.string().email(t.errEmail),
    username: z.string().min(2, t.errUsername),
    password: z.string().min(6, t.errPassword),
  });
  const parsed = schema.safeParse({
    email: formData.get("email"),
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { email, username, password } = parsed.data;
  const user = await prisma.user.create({
    data: {
      email,
      username,
      displayName: username,
      passwordHash: hashPassword(password),
      role: "OWNER",
    },
  });
  await setSession({ uid: user.id, role: user.role, name: user.displayName ?? user.username });
  redirect("/");
}

/** 账号密码登录 */
export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const t = getDictionary(await getLocale()).auth;

  const account = String(formData.get("account") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!account || !password) return { error: t.errFillAll };

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: account }, { username: account }] },
  });
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return { error: t.errBadCredentials };
  }
  if (user.status !== "ACTIVE") return { error: t.errDisabled };

  await setSession({ uid: user.id, role: user.role, name: user.displayName ?? user.username });

  const next = String(formData.get("next") ?? "/");
  redirect(next.startsWith("/") ? next : "/");
}

/** 退出登录 */
export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
