import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifySsoToken } from "@/lib/sso";
import { getSystemConfig } from "@/lib/system-config";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

// SSO 回调：qwq-sso 带 ?token=... 回来，这里校验并建立本地会话
export async function GET(req: NextRequest) {
  const fail = () =>
    NextResponse.redirect(new URL("/login?error=sso_failed", req.url));

  try {
    return await handleCallback(req, fail);
  } catch (e) {
    console.error("[sso/callback] error:", e);
    return fail();
  }
}

async function handleCallback(req: NextRequest, fail: () => NextResponse) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return fail();

  const ssoUser = await verifySsoToken(token);
  if (!ssoUser || (ssoUser.status && ssoUser.status !== "active")) return fail();

  const subject = String(ssoUser.uid_seq ?? ssoUser.id);
  const sysCfg = await getSystemConfig();

  // 可选邮箱白名单
  const allow = sysCfg.ssoAllowedEmails
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length && ssoUser.email && !allow.includes(ssoUser.email)) return fail();

  const email = ssoUser.email ?? `${subject}@sso.local`;
  const displayName = ssoUser.name ?? email;

  // 1) 先按 SSO 主体找；2) 再按邮箱关联；3) 否则新建
  let user = await prisma.user.findFirst({
    where: { ssoProvider: "qwq-sso", ssoSubject: subject },
  });

  if (!user && ssoUser.email) {
    const byEmail = await prisma.user.findUnique({ where: { email: ssoUser.email } });
    if (byEmail) {
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { ssoProvider: "qwq-sso", ssoSubject: subject },
      });
    }
  }

  if (!user) {
    let username =
      (ssoUser.email?.split("@")[0] ?? `sso_${subject}`).replace(/[^a-zA-Z0-9_.-]/g, "") ||
      `sso_${subject}`;
    if (await prisma.user.findUnique({ where: { username } })) {
      username = `${username}_${subject}`;
    }
    user = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        role: sysCfg.ssoDefaultRole || "ADMIN",
        ssoProvider: "qwq-sso",
        ssoSubject: subject,
      },
    });
  }

  if (user.status !== "ACTIVE") return fail();

  const sessionToken = await createSessionToken({
    uid: user.id,
    role: user.role,
    name: user.displayName ?? user.username,
  });
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
