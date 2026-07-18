import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateApiKey, keyAllowsMethod, getClientIp } from "@/lib/api-auth";
import {
  dispatchByGroupCode,
  dispatchByTemplateCode,
  type DispatchOutcome,
} from "@/lib/dispatch/engine";

function respond(r: DispatchOutcome) {
  if (!r.ok) {
    return NextResponse.json({ success: false, error: r.error, detail: r.info }, { status: r.status ?? 502 });
  }
  return NextResponse.json({ success: true, channelId: r.channelId, method: r.method, detail: r.info });
}

// 公开发送接口：外部系统带 API 密钥调用
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const key = auth.key;
  const ip = getClientIp(req) ?? undefined;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "请求体不是合法 JSON / invalid JSON body" }, { status: 400 });
  }

  const group = typeof body.group === "string" ? body.group : undefined;
  const template = typeof body.template === "string" ? body.template : undefined;
  const to = typeof body.to === "string" ? body.to : undefined;
  const subject = typeof body.subject === "string" ? body.subject : undefined;
  const content = typeof body.content === "string" ? body.content : "";
  const templateCode = typeof body.templateCode === "string" ? body.templateCode : undefined;
  const variables =
    body.variables && typeof body.variables === "object"
      ? (body.variables as Record<string, string>)
      : {};

  const payload = { to, subject, content, variables, templateCode };

  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  if (template) {
    const tpl = await prisma.template.findUnique({ where: { code: template } });
    if (!tpl || !tpl.enabled) {
      return NextResponse.json({ success: false, error: `模板不存在或已停用: ${template}` }, { status: 404 });
    }
    if (!keyAllowsMethod(key, tpl.method)) {
      return NextResponse.json({ success: false, error: `密钥无 ${tpl.method} 权限` }, { status: 403 });
    }
    return respond(
      await dispatchByTemplateCode(template, payload, { source: "API", apiKeyId: key.id, requestIp: ip }),
    );
  }

  if (group) {
    const g = await prisma.channelGroup.findUnique({ where: { code: group } });
    if (!g) return NextResponse.json({ success: false, error: `分组不存在: ${group}` }, { status: 404 });
    if (!keyAllowsMethod(key, g.method)) {
      return NextResponse.json({ success: false, error: `密钥无 ${g.method} 权限` }, { status: 403 });
    }
    if (!content) return NextResponse.json({ success: false, error: "缺少 content" }, { status: 400 });
    return respond(
      await dispatchByGroupCode(group, payload, { source: "API", apiKeyId: key.id, requestIp: ip }),
    );
  }

  return NextResponse.json(
    { success: false, error: "必须提供 group（分组编号）或 template（模板编号）" },
    { status: 400 },
  );
}
