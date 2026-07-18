import { prisma } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/dictionaries";
import { PageHeader } from "@/components/page-header";
import type { MethodKey } from "@/lib/constants";
import {
  Activity,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Boxes,
  Layers,
  FileText,
  KeyRound,
} from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "slate" | "green" | "red" | "indigo";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const { locale, dict } = await getI18n();
  const d = dict.dashboard;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    todayTotal,
    todaySuccess,
    todayFailed,
    byMethodRaw,
    channelCount,
    groupCount,
    templateCount,
    keyCount,
  ] = await Promise.all([
    prisma.callLog.count({ where: { createdAt: { gte: start } } }),
    prisma.callLog.count({ where: { createdAt: { gte: start }, status: "SUCCESS" } }),
    prisma.callLog.count({ where: { createdAt: { gte: start }, status: "FAILED" } }),
    prisma.callLog.groupBy({
      by: ["method"],
      where: { createdAt: { gte: start } },
      _count: { _all: true },
    }),
    prisma.channel.count(),
    prisma.channelGroup.count(),
    prisma.template.count(),
    prisma.apiKey.count(),
  ]);

  const methodStats = byMethodRaw
    .map((m) => ({ method: m.method as MethodKey, count: m._count._all }))
    .sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...methodStats.map((m) => m.count));
  const top = methodStats[0];
  const dateStr = now.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US");

  return (
    <>
      <PageHeader title={d.title} description={interpolate(d.subtitle, { date: dateStr })} />

      {/* 核心指标 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={d.todayCalls} value={todayTotal} icon={Activity} tone="indigo" />
        <StatCard label={d.todaySuccess} value={todaySuccess} icon={CheckCircle2} tone="green" />
        <StatCard label={d.todayFailed} value={todayFailed} icon={XCircle} tone="red" />
        <StatCard
          label={d.topModule}
          value={top ? dict.methods[top.method] ?? top.method : "—"}
          icon={TrendingUp}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* 各板块调用分布 */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">{d.methodDistribution}</h2>
          {methodStats.length === 0 ? (
            <p className="mt-8 mb-6 text-center text-sm text-slate-400">{d.noCallsToday}</p>
          ) : (
            <div className="mt-4 space-y-3">
              {methodStats.map((m) => (
                <div key={m.method} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm text-slate-600">
                    {dict.methods[m.method] ?? m.method}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${(m.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-medium text-slate-700">
                    {m.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 配置概览 */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">{d.configOverview}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: d.channels, value: channelCount, icon: Boxes },
              { label: d.groups, value: groupCount, icon: Layers },
              { label: d.templates, value: templateCount, icon: FileText },
              { label: d.apiKeys, value: keyCount, icon: KeyRound },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-slate-50 p-3">
                <s.icon className="h-4 w-4 text-slate-400" />
                <div className="mt-2 text-lg font-bold text-slate-900">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </>
  );
}
