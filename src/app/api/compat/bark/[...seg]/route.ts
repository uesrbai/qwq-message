import { NextResponse } from "next/server";
import { runCompat, readInput } from "@/lib/compat";

// Bark（iOS 推送）兼容端点
//   /api/compat/bark/<token>                标题/正文放 body 或 query
//   /api/compat/bark/<token>/<body>
//   /api/compat/bark/<token>/<title>/<body>
type Ctx = { params: Promise<{ seg: string[] }> };

async function handle(req: Request, { params }: Ctx) {
  const { seg } = await params;
  const token = seg[0] ?? "";
  const input = await readInput(req);

  let title = input.title || "";
  let body = input.body || "";
  if (seg.length >= 3) {
    title = decodeURIComponent(seg[1]);
    body = decodeURIComponent(seg[2]);
  } else if (seg.length === 2) {
    body = decodeURIComponent(seg[1]);
  }

  const r = await runCompat(req, token, {
    title,
    body,
    groupOverride: input.group,
  });

  if (r.ok) {
    return NextResponse.json({ code: 200, message: "success", timestamp: Math.floor(Date.now() / 1000) });
  }
  return NextResponse.json({ code: r.status || 500, message: r.error ?? "failed" }, { status: r.status });
}

export const GET = handle;
export const POST = handle;
