import Link from "next/link";
import { Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { requireFeature } from "@/lib/auth";
import { actionLabel } from "@/lib/audit-label";
import { PageHeader } from "@/components/page-header";
import type { MethodKey } from "@/lib/constants";

const exportBtnCls =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50";

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  await requireFeature("logs");
  const { locale, dict } = await getI18n();
  const p = dict.pages.logs;
  const d = dict.dashboard;
  const t = dict.logs;

  const sp = await searchParams;
  const group = sp.group?.trim() || "";

  const [calls, ops, groups] = await Promise.all([
    prisma.callLog.findMany({
      where: group ? { groupCode: group } : undefined,
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { channel: true },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.channelGroup.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const fmt = (dt: Date) => dt.toLocaleString(locale === "zh" ? "zh-CN" : "en-US");
  const callsExportHref = `/api/export/logs?type=calls${group ? `&group=${encodeURIComponent(group)}` : ""}`;

  return (
    <>
      <PageHeader title={p.title} description={p.desc} />

      {/* 分组筛选 */}
      <form method="get" action="/logs" className="mb-5 flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-600">{t.filterGroup}</label>
        <select
          name="group"
          defaultValue={group}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
        >
          <option value="">{t.allGroups}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.code}>
              {dict.methods[g.method as MethodKey] ?? g.method} › {g.name}（{g.code}）
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.filter}
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 最近调用记录 */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {t.callsTitle}
              {group && <span className="ml-2 text-xs font-normal text-slate-400">{group}</span>}
            </h2>
            <a href={callsExportHref} className={exportBtnCls}>
              <Download className="h-3.5 w-3.5" />
              {t.exportExcel}
            </a>
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
                    <th className="px-5 py-2.5 font-medium">{t.colGroup}</th>
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
                        {r.groupCode ?? r.templateCode ?? "—"}
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
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">{t.opsTitle}</h2>
            <a href="/api/export/logs?type=ops" className={exportBtnCls}>
              <Download className="h-3.5 w-3.5" />
              {t.exportExcel}
            </a>
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

      <p className="mt-4 text-xs text-slate-400">
        <Link href="/channels" className="underline hover:text-slate-600">
          {dict.nav.channels}
        </Link>
      </p>
    </>
  );
}
