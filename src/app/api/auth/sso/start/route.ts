import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import {
  getSsoOidcConfig,
  buildAuthorizeUrl,
  ssoCallbackUrl,
  ssoPublicBase,
  baseFromHeaders,
} from "@/lib/sso";

export const SSO_STATE_COOKIE = "qwq_sso_state";
export const SSO_BIND_COOKIE = "qwq_sso_bind_uid";

// 发起 SSO（OIDC 授权码流程）
//   普通登录：/api/auth/sso/start
//   绑定当前账号：/api/auth/sso/start?mode=bind（需已登录）
export async function GET(req: NextRequest) {
  try {
    const base = await ssoPublicBase(req);
    const cfg = await getSsoOidcConfig();
    if (!cfg) {
      return NextResponse.redirect(`${base}/login?error=sso_not_configured`);
    }

    // 绑定模式：必须先登录，记下当前用户 id
    let bindUid = "";
    if (req.nextUrl.searchParams.get("mode") === "bind") {
      const session = await getSession();
      if (!session) return NextResponse.redirect(`${base}/login`);
      bindUid = session.uid;
    }

    const redirectUri = ssoCallbackUrl(base);
    const state = randomBytes(16).toString("hex");
    const url = buildAuthorizeUrl(cfg.root, cfg.clientId, redirectUri, state);

    const res = NextResponse.redirect(url);
    const secure = process.env.NODE_ENV === "production";
    // 跨站回跳(qwqsso→本站)时，SameSite=Lax 在部分浏览器/代理下不稳，state cookie 丢失会报 sso_nostate。
    // 生产用 None+Secure 确保回跳时一定带上；本地(http)退回 lax（None 必须配 Secure，否则被浏览器拒）。
    const sameSite = secure ? "none" : "lax";
    res.cookies.set(SSO_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite,
      secure,
      path: "/",
      maxAge: 600,
    });
    res.cookies.set(SSO_BIND_COOKIE, bindUid, {
      httpOnly: true,
      sameSite,
      secure,
      path: "/",
      maxAge: bindUid ? 600 : 0,
    });
    return res;
  } catch (e) {
    console.error("[sso/start] error:", e);
    return NextResponse.redirect(`${baseFromHeaders(req)}/login?error=sso_failed`);
  }
}
