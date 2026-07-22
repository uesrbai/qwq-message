"use client";

import { Link2, CheckCircle2, Unlink, AlertCircle } from "lucide-react";
import { useI18n } from "../i18n-provider";
import { unbindSsoAction } from "@/lib/actions/users";

export function SsoBind({
  bound,
  ssoEnabled,
  justBound,
  errorCode,
}: {
  bound: boolean;
  ssoEnabled: boolean;
  justBound: boolean;
  errorCode?: string;
}) {
  const { dict } = useI18n();
  const t = dict.settings;

  if (!ssoEnabled) return null;

  const errText = errorCode
    ? errorCode === "sso_bound_other"
      ? t.ssoBoundOther
      : `${t.ssoBindFailed}（${errorCode}）`
    : "";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">{t.ssoBindTitle}</h2>
      <p className="mt-1 text-sm text-slate-500">{t.ssoBindHint}</p>

      {justBound && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          {t.ssoBoundOk}
        </p>
      )}

      {errText && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {errText}
        </p>
      )}

      <div className="mt-4">
        {bound ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              {t.ssoBound}
            </span>
            <form action={unbindSsoAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Unlink className="h-4 w-4" />
                {t.ssoUnbind}
              </button>
            </form>
          </div>
        ) : (
          <a
            href="/api/auth/sso/start?mode=bind"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Link2 className="h-4 w-4" />
            {t.ssoBindBtn}
          </a>
        )}
      </div>
    </div>
  );
}
