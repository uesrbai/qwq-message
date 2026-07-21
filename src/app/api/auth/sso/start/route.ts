import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSsoConfig, buildSsoLoginUrl, ssoCallbackUrl } from "@/lib/sso";

// 发起 SSO 登录：跳转到 qwq-sso 登录页
export async function GET(req: NextRequest) {
  try {
    const cfg = await getSsoConfig();
    if (!cfg) {
      return NextResponse.redirect(new URL("/login?error=sso_not_configured", req.url));
    }
    // 回调地址必须与 SSO 后台注册的 callback_url 完全一致，
    // 因此优先用系统设置里的应用地址，而非可能被代理改写的请求地址。
    const redirectUri = await ssoCallbackUrl(req.nextUrl.origin);
    return NextResponse.redirect(buildSsoLoginUrl(cfg.root, redirectUri));
  } catch (e) {
    // 配置有误也不该 500，记录真实原因后优雅跳回
    console.error("[sso/start] error:", e);
    return NextResponse.redirect(new URL("/login?error=sso_failed", req.url));
  }
}
