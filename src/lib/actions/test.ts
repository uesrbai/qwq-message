"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canUseMethod, canAccessFeature } from "@/lib/permissions";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { sendViaChannel, dispatchByTemplateCode } from "@/lib/dispatch/engine";

export type TestResult =
  | { ok?: boolean; error?: string; detail?: string; channelName?: string }
  | undefined;

function str(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}

export async function testSendAction(_prev: TestResult, fd: FormData): Promise<TestResult> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).test;
  if (!canAccessFeature(user, "test")) return { error: t.errNoMethod };

  const mode = str(fd, "mode") === "TEMPLATE" ? "TEMPLATE" : "CHANNEL";
  const to = str(fd, "to");

  let variables: Record<string, string> = {};
  if (mode === "TEMPLATE") {
    // 按模板测试：变量来自逐个输入框 var_<变量名>，无需填 JSON
    for (const [k, v] of fd.entries()) {
      if (k.startsWith("var_")) variables[k.slice(4)] = String(v);
    }
  } else {
    const varsRaw = str(fd, "variables");
    if (varsRaw) {
      try {
        variables = JSON.parse(varsRaw);
      } catch {
        return { error: t.errVarsJson };
      }
    }
  }

  // ---------- 按模板测试：走真实分发链路（含容灾）----------
  if (mode === "TEMPLATE") {
    const tplCode = str(fd, "tplCode");
    if (!tplCode) return { error: t.errPickTemplate };

    const tpl = await prisma.template.findUnique({ where: { code: tplCode } });
    if (!tpl || !tpl.enabled) return { error: t.errPickTemplate };
    if (!canUseMethod(user, tpl.method)) return { error: t.errNoMethod };

    const r = await dispatchByTemplateCode(tplCode, { to, content: "", variables }, { source: "TEST" });

    let channelName: string | undefined;
    if (r.channelId) {
      const ch = await prisma.channel.findUnique({ where: { id: r.channelId } });
      channelName = ch?.name;
    }
    revalidatePath("/");
    return { ok: r.ok, error: r.error, detail: r.info, channelName };
  }

  // ---------- 按渠道测试：直接指定渠道 ----------
  const channelId = str(fd, "channelId");
  const content = str(fd, "content");
  const subject = str(fd, "subject");
  const templateCode = str(fd, "templateCode");

  if (!channelId) return { error: t.errPickChannel };
  if (!content && !templateCode) return { error: t.errContent };

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { group: true },
  });
  if (!channel) return { error: t.errPickChannel };
  if (!canUseMethod(user, channel.group.method)) return { error: t.errNoMethod };

  const r = await sendViaChannel(
    { id: channel.id, provider: channel.provider, config: channel.config },
    {
      to,
      content,
      subject: subject || undefined,
      templateCode: templateCode || undefined,
      variables,
    },
    { source: "TEST", groupCode: channel.group.code },
  );

  revalidatePath("/");
  return { ok: r.ok, error: r.ok ? undefined : r.error, detail: r.info, channelName: channel.name };
}
