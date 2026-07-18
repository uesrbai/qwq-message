import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySessionToken, createSessionToken, type SessionPayload } from "./session";
import { canAccessFeature } from "./permissions";

/** 读取当前会话（未登录返回 null）——仅解 Cookie，不查库 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** 读取当前登录用户（查库，未登录返回 null） */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user || user.status !== "ACTIVE") return null;
  return user;
}

/** 页面/动作里要求必须登录，否则跳登录页 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** 页面里要求登录且有该功能权限，IAM 无权则跳回首页 */
export async function requireFeature(feature: string) {
  const user = await requireUser();
  if (!canAccessFeature(user, feature)) redirect("/");
  return user;
}

/** 登录成功后写入会话 Cookie */
export async function setSession(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** 退出登录 */
export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
