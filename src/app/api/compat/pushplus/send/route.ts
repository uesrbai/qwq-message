import { NextResponse } from "next/server";
import { runCompat, readInput } from "@/lib/compat";

// PushPlus 兼容端点
//   推送地址填：https://<域名>/api/compat/pushplus/send
//   JSON body：token（=API密钥~分组编号）、title、content
async function handle(req: Request) {
  const input = await readInput(req);
  const token = input.token || "";

  const r = await runCompat(req, token, {
    title: input.title,
    body: input.content,
    groupOverride: input.group || input.topic,
  });

  if (r.ok) {
    return NextResponse.json({ code: 200, msg: "请求成功", data: r.channelId ?? "" });
  }
  return NextResponse.json({ code: r.status || 500, msg: r.error ?? "failed" }, { status: r.status });
}

export const GET = handle;
export const POST = handle;
