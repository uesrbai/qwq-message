import { prisma } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { requireFeature } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import type { MethodKey } from "@/lib/constants";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

// 把 "channel.create" 这样的操作码翻成可读文字
function actionLabel(dict: Dictionary, locale: Locale, code: string): string {
  const [entity, verb] = code.split(".");
  const v = dict.audit.verbs[verb as keyof Dictionary["audit"]["verbs"]] ?? verb;
  const e = dict.audit.entities[entity as keyof Dictionary["audit"]["entities"]] ?? entity;
  return locale === "zh" ? `${v}${e}` : `${v} ${e}`;
}

export default async function LogsPage() {
  await requireFeature("logs");
  const { locale, dict } = await getI18n();
  const p = dict.pages.logs;
  const d = dict.dashboard;
  const t = dict.logs;

  const [calls, ops] = await Promise.all([
    prisma.callLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const fmt = (dt: Date) => dt.toLocaleString(locale === "zh" ? "zh-CN" : "en-US");

  return (
    <>
      <PageHeader title={p.title} description={p.desc} />
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 最近调用记录 */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">{t.callsTitle}</h2>
          </div>
          {calls.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">{d.noRecords}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="px-5 py-2.5 font-medium">{d.colTime}</th>
                    <th className="px-5 py-2.5 font-medium">{d.colMethod}</th>
                    <th className="px-5 py-2.5 font-medium">{d.colTemplate}</th>
                    <th className="px-5 py-2.5 font-medium">{d.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((r) => (
                    <tr key={r.id} className="border-t border-slate-50">
                      <td className="px-5 py-2.5 text-slate-500">{fmt(r.createdAt)}</td>
                      <td className="px-5 py-2.5 text-slate-700">
                        {dict.methods[r.method as MethodKey] ?? r.method}
                      </td>
                      <td className="px-5 py-2.5 text-slate-500">
                        {r.templateCode ?? r.groupCode ?? "—"}
                      </td>
                      <td className="px-5 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.status === "SUCCESS"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {r.status === "SUCCESS" ? d.success : d.failed}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 操作记录 */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">{t.opsTitle}</h2>
          </div>
          {ops.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">{t.noOps}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="px-5 py-2.5 font-medium">{d.colTime}</th>
                    <th className="px-5 py-2.5 font-medium">{t.colUser}</th>
                    <th className="px-5 py-2.5 font-medium">{t.colAction}</th>
                  </tr>
                </thead>
                <tbody>
                  {ops.map((o) => (
                    <tr key={o.id} className="border-t border-slate-50">
                      <td className="px-5 py-2.5 text-slate-500">{fmt(o.createdAt)}</td>
                      <td className="px-5 py-2.5 text-slate-700">{o.userName ?? "—"}</td>
                      <td className="px-5 py-2.5 text-slate-600">
                        {actionLabel(dict, locale, o.action)}
                        {o.target ? <span className="text-slate-400"> · {o.target}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
