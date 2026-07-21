"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { saveSystemConfig } from "@/lib/system-config";
import { logOperation } from "@/lib/audit";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export type SysState = { ok?: boolean; error?: string } | undefined;

export async function saveSystemConfigAction(_prev: SysState, fd: FormData): Promise<SysState> {
  const user = await requireUser();
  const t = getDictionary(await getLocale()).system;
  if (user.role === "IAM") return { error: t.errNoPermission };

  const s = (k: string) => String(fd.get(k) ?? "").trim();
  const role = s("ssoDefaultRole");

  const patch: Record<string, string> = {
    appUrl: s("appUrl").replace(/\/+$/, ""),
    ssoBaseUrl: s("ssoBaseUrl"),
    ssoDefaultRole: role === "IAM" ? "IAM" : "ADMIN",
    ssoAllowedEmails: s("ssoAllowedEmails"),
  };
  // API Key 留空 = 不修改（沿用原值）
  const apiKey = s("ssoApiKey");
  if (apiKey) patch.ssoApiKey = apiKey;

  await saveSystemConfig(patch);
  await logOperation(user, "setting.update", "系统设置 / system config");
  revalidatePath("/system");
  return { ok: true };
}
