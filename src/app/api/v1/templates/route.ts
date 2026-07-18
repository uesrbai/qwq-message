import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateApiKey, keyAllowsMethod } from "@/lib/api-auth";

// 模板查询接口：调用方可据此拿到模板列表 / 单个模板需要哪些变量
//   GET /api/v1/templates            列出全部可用模板
//   GET /api/v1/templates?code=xxx   查单个模板
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const key = auth.key;

  const code = new URL(req.url).searchParams.get("code");

  const rows = await prisma.template.findMany({
    where: { enabled: true, ...(code ? { code } : {}) },
    orderBy: { createdAt: "desc" },
  });

  const list = rows
    .filter((t) => keyAllowsMethod(key, t.method))
    .map((t) => {
      let variables: string[] = [];
      try {
        variables = JSON.parse(t.variables || "[]") as string[];
      } catch {
        variables = [];
      }
      const variablesJson: Record<string, string> = {};
      for (const v of variables) variablesJson[v] = "";
      return {
        code: t.code,
        name: t.name,
        method: t.method,
        subject: t.subject ?? undefined,
        content: t.content,
        variables, // 变量名清单
        variablesJson, // 可直接拿去填值的 JSON 骨架
      };
    });

  if (code) {
    if (list.length === 0) {
      return NextResponse.json(
        { success: false, error: `模板不存在或无权限: ${code}` },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, template: list[0] });
  }

  return NextResponse.json({ success: true, count: list.length, templates: list });
}
