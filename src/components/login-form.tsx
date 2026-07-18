"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { loginAction, type ActionState } from "@/lib/actions/auth";
import { useI18n } from "./i18n-provider";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400";

export function LoginForm({
  next,
  ssoEnabled,
  error,
}: {
  next: string;
  ssoEnabled: boolean;
  error?: string;
}) {
  const { dict } = useI18n();
  const t = dict.auth;

  const initialError: ActionState = error
    ? {
        error:
          error === "sso_not_configured"
            ? t.errSsoNotConfigured
            : error === "sso_failed"
              ? t.errSsoFailed
              : t.errGeneric,
      }
    : undefined;

  const [state, action, pending] = useActionState<ActionState, FormData>(
    loginAction,
    initialError,
  );

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.account}</label>
          <input
            name="account"
            autoComplete="username"
            placeholder={t.accountPlaceholder}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.password}</label>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={t.passwordPlaceholder}
            className={inputCls}
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
        >
          <KeyRound className="h-4 w-4" />
          {pending ? t.loggingIn : t.login}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        {t.or}
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <a
        href={ssoEnabled ? "/api/auth/sso/start" : "/login?error=sso_not_configured"}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
          ssoEnabled
            ? "border-slate-300 text-slate-700 hover:bg-slate-50"
            : "cursor-not-allowed border-slate-200 text-slate-400"
        }`}
      >
        {t.ssoLogin}
        {!ssoEnabled && t.ssoNotConfigured}
      </a>
    </div>
  );
}
