import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import {
  getSsoOidcConfig,
  buildAuthorizeUrl,
  ssoCallbackUrl,
  ssoPublicBase,
  baseFromHeaders,
} from "@/lib/sso";

export const SSO_STATE_COOKIE = "qwq_sso_state";

// 发起 SSO 登录（OIDC 授权码流程）：跳到 qwq-sso 授权页
export async function GET(req: NextRequest) {
  try {
    const base = await ssoPublicBase(req);
    const cfg = await getSsoOidcConfig();
    if (!cfg) {
      return NextResponse.redirect(`${base}/login?error=sso_not_configured`);
    }
    const redirectUri = ssoCallbackUrl(base);
    const state = randomBytes(16).toString("hex");
    const url = buildAuthorizeUrl(cfg.root, cfg.clientId, redirectUri, state);

    const res = NextResponse.redirect(url);
    res.cookies.set(SSO_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    return res;
  } catch (e) {
    console.error("[sso/start] error:", e);
    return NextResponse.redirect(`${baseFromHeaders(req)}/login?error=sso_failed`);
  }
}
