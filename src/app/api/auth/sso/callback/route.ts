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
import {
  createSessionToken,
  SESSION_COOKIE,
  createSsoPendingToken,
  SSO_PENDING_COOKIE,
} from "@/lib/session";
import { SSO_STATE_COOKIE, SSO_BIND_COOKIE } from "../start/route";

// SSO 回调（OIDC）：换 token → 取用户 → 绑定 或 登录
export async function GET(req: NextRequest) {
  let base: string;
  try {
    base = await ssoPublicBase(req);
  } catch {
    base = baseFromHeaders(req);
  }
  // 失败一律回登录页并带上细分错误码，同时清掉登录态，保证错误能被看到
  const fail = (err = "sso_failed") => {
    const res = NextResponse.redirect(`${base}/login?error=${err}`);
    res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    clearSsoCookies(res);
    return res;
  };

  try {
    return await handleCallback(req, base, fail);
  } catch (e) {
    console.error("[sso/callback] error:", e);
    return fail("sso_exception");
  }
}

function clearSsoCookies(res: NextResponse) {
  res.cookies.set(SSO_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(SSO_BIND_COOKIE, "", { path: "/", maxAge: 0 });
}

async function handleCallback(
  req: NextRequest,
  base: string,
  fail: (err?: string) => NextResponse,
) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthErr = req.nextUrl.searchParams.get("error");
  const savedState = req.cookies.get(SSO_STATE_COOKIE)?.value;
  const bindUid = req.cookies.get(SSO_BIND_COOKIE)?.value || "";

  // qwq-sso 直接带回的错误（如用户拒绝授权、client 配置问题）
  if (oauthErr) return fail(`sso_oauth_${oauthErr}`);
  if (!code || !state) return fail("sso_nocode");
  if (!savedState) return fail("sso_nostate"); // state cookie 丢了（跨站 cookie 未回传）
  if (state !== savedState) return fail("sso_badstate");

  const cfg = await getSsoOidcConfig();
  if (!cfg) return fail("sso_nocfg");

  const redirectUri = ssoCallbackUrl(base);
  const tokens = await exchangeCodeForToken(cfg, code, redirectUri);
  if (!tokens?.access_token) return fail("sso_token");

  const ssoUser = await fetchOidcUserInfo(cfg.root, tokens.access_token);
  if (!ssoUser) return fail("sso_userinfo");
  if (ssoUser.status && ssoUser.status !== "active") return fail("sso_inactive");

  const subject = ssoUser.sub;

  // ============ 绑定流程 ============
  if (bindUid) {
    const owner = await prisma.user.findUnique({ where: { id: bindUid } });
    if (!owner) return fail("sso_owner_missing");
    // 该 SSO 身份是否已被别人绑走
    const already = await prisma.user.findFirst({
      where: { ssoProvider: "qwq-sso", ssoSubject: subject },
    });
    if (already && already.id !== bindUid) {
      return NextResponse.redirect(`${base}/settings?error=sso_bound_other`);
    }

    await prisma.user.update({
      where: { id: bindUid },
      data: { ssoProvider: "qwq-sso", ssoSubject: subject },
    });
    const res = NextResponse.redirect(`${base}/settings?bound=1`);
    clearSsoCookies(res);
    return res;
  }

  // ============ 登录流程（只认已绑定账号，不自动建号）============
  const user = await prisma.user.findFirst({
    where: { ssoProvider: "qwq-sso", ssoSubject: subject },
  });
  if (!user) {
    // 未绑定：不再直接报错，而是引导用户去绑定页用平台账号登录绑定。
    // 把 SSO 身份暂存在短期签名令牌里带过去。
    const pending = await createSsoPendingToken({
      sub: subject,
      email: ssoUser.email,
      name: ssoUser.name,
    });
    const res = NextResponse.redirect(`${base}/link-sso`);
    res.cookies.set(SSO_PENDING_COOKIE, pending, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 15,
    });
    clearSsoCookies(res);
    return res;
  }

  // 可选邮箱白名单
  const sysCfg = await getSystemConfig();
  const allow = sysCfg.ssoAllowedEmails
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length && ssoUser.email && !allow.includes(ssoUser.email)) {
    return fail("sso_email_denied");
  }
  if (user.status !== "ACTIVE") return fail("sso_disabled");

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
  clearSsoCookies(res);
  return res;
}
