import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSsoOidcConfig,
  exchangeCodeForToken,
  fetchOidcUserInfo,
  ssoCallbackUrl,
  ssoPublicBase,
  baseFromHeaders,
} from "@/lib/sso";
import { getSystemConfig } from "@/lib/system-config";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { SSO_STATE_COOKIE } from "../start/route";

// SSO 回调（OIDC）：qwq-sso 带 ?code=&state= 回来，换 token → 取用户 → 建会话
export async function GET(req: NextRequest) {
  let base: string;
  try {
    base = await ssoPublicBase(req);
  } catch {
    base = baseFromHeaders(req);
  }
  const fail = () => NextResponse.redirect(`${base}/login?error=sso_failed`);

  try {
    return await handleCallback(req, base, fail);
  } catch (e) {
    console.error("[sso/callback] error:", e);
    return fail();
  }
}

async function handleCallback(req: NextRequest, base: string, fail: () => NextResponse) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get(SSO_STATE_COOKIE)?.value;

  // 防 CSRF：state 必须与发起时一致
  if (!code || !state || !savedState || state !== savedState) return fail();

  const cfg = await getSsoOidcConfig();
  if (!cfg) return fail();

  const redirectUri = ssoCallbackUrl(base);
  const tokens = await exchangeCodeForToken(cfg, code, redirectUri);
  if (!tokens?.access_token) return fail();

  const ssoUser = await fetchOidcUserInfo(cfg.root, tokens.access_token);
  if (!ssoUser) return fail();
  if (ssoUser.status && ssoUser.status !== "active") return fail();

  const subject = ssoUser.sub;
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
      `sso_${subject.slice(0, 8)}`;
    if (await prisma.user.findUnique({ where: { username } })) {
      username = `${username}_${subject.slice(0, 6)}`;
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
  const res = NextResponse.redirect(`${base}/`);
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  // 清掉一次性的 state
  res.cookies.set(SSO_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
