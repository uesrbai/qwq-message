import { NextResponse } from "next/server";
import { runCompat, readInput } from "@/lib/compat";

// 通用兼容端点：适配任意"填一个URL+标题/正文"的系统
//   /api/compat/generic/<API密钥~分组编号>
//   接受 title + content/body/text/message/desp（JSON 或表单或 query），可选 to
type Ctx = { params: Promise<{ token: string }> };

async function handle(req: Request, { params }: Ctx) {
  const { token } = await params;
  const input = await readInput(req);

  const r = await runCompat(req, token, {
    title: input.title || input.subject,
    body: input.content || input.body || input.text || input.message || input.desp,
    to: input.to,
    groupOverride: input.group,
  });

  if (r.ok) {
    return NextResponse.json({ success: true, channelId: r.channelId });
  }
  return NextResponse.json({ success: false, error: r.error ?? "failed" }, { status: r.status });
}

export const GET = handle;
export const POST = handle;
