"use client";

import { useActionState } from "react";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { changePasswordAction, type FormState } from "@/lib/actions/users";
import { useI18n } from "../i18n-provider";
import { Field, inputCls } from "../ui/field";

export function ChangePassword({ hasPassword }: { hasPassword: boolean }) {
  const { dict } = useI18n();
  const t = dict.settings;
  const [state, action, pending] = useActionState<FormState, FormData>(
    changePasswordAction,
    undefined,
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">{t.changePassword}</h2>
      <p className="mt-1 text-sm text-slate-500">{t.changePasswordHint}</p>
      <form action={action} className="mt-4 max-w-sm space-y-3">
        {hasPassword && (
          <Field label={t.currentPassword}>
            <input name="current" type="password" autoComplete="current-password" className={inputCls} />
          </Field>
        )}
        <Field label={t.newPassword}>
          <input name="next" type="password" autoComplete="new-password" className={inputCls} />
        </Field>
        <Field label={t.confirmPassword}>
          <input name="confirm" type="password" autoComplete="new-password" className={inputCls} />
        </Field>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}
        {state?.ok && (
          <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            {t.pwdChanged}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <KeyRound className="h-4 w-4" />
          {pending ? t.saving : t.savePassword}
        </button>
      </form>
    </div>
  );
}
