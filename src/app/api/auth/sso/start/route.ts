import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getSsoConfig,
  buildSsoLoginUrl,
  ssoCallbackUrl,
  ssoPublicBase,
  baseFromHeaders,
} from "@/lib/sso";

// 发起 SSO 登录：跳转到 qwq-sso 登录页
export async function GET(req: NextRequest) {
  try {
    const base = await ssoPublicBase(req);
    const cfg = await getSsoConfig();
    if (!cfg) {
      return NextResponse.redirect(`${base}/login?error=sso_not_configured`);
    }
    // 回调地址必须与 SSO 后台注册的 callback_url 完全一致
    const redirectUri = ssoCallbackUrl(base);
    return NextResponse.redirect(buildSsoLoginUrl(cfg.root, redirectUri));
  } catch (e) {
    console.error("[sso/start] error:", e);
    return NextResponse.redirect(`${baseFromHeaders(req)}/login?error=sso_failed`);
  }
}
