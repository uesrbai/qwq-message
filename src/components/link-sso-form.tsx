"use client";

import { useActionState } from "react";
import { Link2, ShieldCheck } from "lucide-react";
import { linkSsoAction, type ActionState } from "@/lib/actions/auth";
import { useI18n } from "./i18n-provider";
import { useFormValues } from "./ui/use-form-values";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400";

export function LinkSsoForm({
  ssoLabel,
  ssoEmail,
}: {
  ssoLabel: string;
  ssoEmail?: string;
}) {
  const { dict } = useI18n();
  const t = dict.auth;
  const l = dict.linkSso;
  const { bind } = useFormValues({ account: "", password: "" });

  const [state, action, pending] = useActionState<ActionState, FormData>(
    linkSsoAction,
    undefined,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg bg-indigo-50 px-3.5 py-3 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
        <div className="min-w-0">
          <p className="font-medium text-indigo-900">{l.ssoAccount}</p>
          <p className="truncate text-indigo-700">{ssoLabel}</p>
          {ssoEmail && ssoEmail !== ssoLabel && (
            <p className="truncate text-xs text-indigo-500">{ssoEmail}</p>
          )}
        </div>
      </div>

      <form action={action} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.account}</label>
          <input
            name="account"
            autoComplete="username"
            {...bind("account")}
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
            {...bind("password")}
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
          <Link2 className="h-4 w-4" />
          {pending ? l.binding : l.bindBtn}
        </button>
      </form>

      <a
        href="/login"
        className="block text-center text-sm text-slate-500 hover:text-slate-700"
      >
        {l.cancel}
      </a>
    </div>
  );
}
