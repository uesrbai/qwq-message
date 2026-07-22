"use client";

import { Unlink, Trash2, ShieldAlert } from "lucide-react";
import { useI18n } from "../i18n-provider";
import { adminUnbindSsoAction, adminDeleteSsoUserAction } from "@/lib/actions/users";

export type SsoBindingRow = {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  role: string;
  ssoSubject: string;
  hasPassword: boolean;
};

export function SsoBindingsAdmin({ rows }: { rows: SsoBindingRow[] }) {
  const { dict } = useI18n();
  const t = dict.system.ssoBindings;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">{t.title}</h2>
      <p className="mt-1 text-sm text-slate-500">{t.desc}</p>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">
          {t.empty}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => {
            // 影子账号：非拥有者、且没有本地密码（只能靠 SSO 登录），大概率是旧版自动建的
            const isShadow = r.role !== "OWNER" && !r.hasPassword;
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {r.displayName || r.username}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                      {r.role}
                    </span>
                    {isShadow && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-600">
                        <ShieldAlert className="h-3 w-3" />
                        {t.shadowTag}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {r.email} · sub: {r.ssoSubject}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <form action={adminUnbindSsoAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      {t.unbind}
                    </button>
                  </form>
                  {isShadow && (
                    <form action={adminDeleteSsoUserAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t.deleteUser}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
