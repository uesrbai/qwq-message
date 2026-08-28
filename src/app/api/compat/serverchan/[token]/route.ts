import { NextResponse } from "next/server";
import { runCompat, readInput } from "@/lib/compat";

// Server酱（ServerChan Turbo）兼容端点
//   推送地址填：https://<域名>/api/compat/serverchan/<API密钥~分组编号>.send
//   body/query：title（标题，必填）、desp（正文，Markdown）
type Ctx = { params: Promise<{ token: string }> };

async function handle(req: Request, { params }: Ctx) {
  const { token: rawToken } = await params;
  const token = rawToken.replace(/\.send$/i, ""); // 客户端会带 .send 后缀
  const input = await readInput(req);

  const r = await runCompat(req, token, {
    title: input.title || input.text,
    body: input.desp || input.short || input.content,
    groupOverride: input.group,
  });

  if (r.ok) {
    return NextResponse.json({
      code: 0,
      message: "",
      data: { pushid: r.channelId ?? "", readkey: "", error: "SUCCESS", errno: 0 },
    });
  }
  return NextResponse.json({ code: r.status || 500, message: r.error ?? "failed" }, { status: r.status });
}

export const GET = handle;
export const POST = handle;
