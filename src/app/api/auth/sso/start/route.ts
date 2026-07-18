import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSsoConfig, buildSsoLoginUrl } from "@/lib/sso";

// 发起 SSO 登录：跳转到 qwq-sso 登录页
export async function GET(req: NextRequest) {
  const cfg = getSsoConfig();
  if (!cfg) {
    return NextResponse.redirect(new URL("/login?error=sso_not_configured", req.url));
  }
  const redirectUri = new URL("/api/auth/sso/callback", req.nextUrl.origin).toString();
  return NextResponse.redirect(buildSsoLoginUrl(cfg.root, redirectUri));
}
