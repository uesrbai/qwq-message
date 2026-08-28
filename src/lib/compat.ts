import "server-only";
import { prisma } from "@/lib/db";
import { authenticateRawKey, keyAllowsMethod, getClientIp } from "@/lib/api-auth";
import { dispatchByGroupCode } from "@/lib/dispatch/engine";

// 兼容层：让别的推送系统（Server酱 / PushPlus / Bark / 通用）按各自格式把消息发进来。
// 约定 token = 「API密钥」或「API密钥~分组编号」；分组也可用 ?group= 覆盖。

export type CompatOutcome = {
  ok: boolean;
  status: number; // HTTP 状态
  error?: string;
  channelId?: string;
};

/** 合并读取入参：查询串 + body（JSON 或表单），统一成字符串字典 */
export async function readInput(req: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const u = new URL(req.url);
    u.searchParams.forEach((v, k) => (out[k] = v));
  } catch {
    /* ignore */
  }
  if (req.method === "POST" || req.method === "PUT") {
    const ct = req.headers.get("content-type") || "";
    try {
      if (ct.includes("application/json")) {
        const j = (await req.json()) as Record<string, unknown>;
        for (const [k, v] of Object.entries(j ?? {})) {
          if (v != null && typeof v !== "object") out[k] = String(v);
        }
      } else if (ct.includes("form")) {
        const f = await req.formData();
        f.forEach((v, k) => (out[k] = String(v)));
      }
    } catch {
      /* ignore body parse errors */
    }
  }
  return out;
}

/** 从 token 里拆出真正的密钥与（可选）分组编号：qwq_live_xxx~groupCode */
export function parseCompatToken(token: string): { key: string; group?: string } {
  const raw = decodeURIComponent(token || "").trim();
  const i = raw.lastIndexOf("~");
  if (i > 0) return { key: raw.slice(0, i), group: raw.slice(i + 1) || undefined };
  return { key: raw };
}

/** 统一处理一条兼容推送：认证 → 定分组 → 校验方式权限 → 分发 */
export async function runCompat(
  req: Request,
  token: string,
  msg: { title?: string; body?: string; to?: string; groupOverride?: string },
): Promise<CompatOutcome> {
  const { key: rawKey, group: groupFromToken } = parseCompatToken(token);
  const groupCode = (msg.groupOverride || groupFromToken || "").trim();
  if (!groupCode) {
    return {
      ok: false,
      status: 400,
      error: "未指定分组：在密钥后加 ~分组编号，或用 ?group=分组编号",
    };
  }

  const auth = await authenticateRawKey(rawKey, req);
  if (!auth.ok) return { ok: false, status: auth.status, error: auth.error };
  const apiKey = auth.key;

  const group = await prisma.channelGroup.findUnique({ where: { code: groupCode } });
  if (!group) return { ok: false, status: 404, error: `分组不存在: ${groupCode}` };
  if (!group.enabled) return { ok: false, status: 400, error: `分组已停用: ${groupCode}` };
  if (!keyAllowsMethod(apiKey, group.method)) {
    return { ok: false, status: 403, error: `密钥无 ${group.method} 权限` };
  }

  const title = (msg.title || "").trim();
  const body = (msg.body || "").trim();
  const content = [title, body].filter(Boolean).join("\n\n");
  if (!content) return { ok: false, status: 400, error: "消息内容为空" };

  const r = await dispatchByGroupCode(
    group.code,
    { to: msg.to, subject: title || undefined, content },
    { source: "API", apiKeyId: apiKey.id, requestIp: getClientIp(req) ?? undefined },
  );
  return { ok: r.ok, status: r.status ?? (r.ok ? 200 : 502), error: r.error, channelId: r.channelId };
}
