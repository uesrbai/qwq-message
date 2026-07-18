"use client";

import { useActionState } from "react";
import { createOwnerAction, type ActionState } from "@/lib/actions/auth";
import { useI18n } from "./i18n-provider";
import { useFormValues } from "./ui/use-form-values";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400";

export function SetupForm() {
  const { dict } = useI18n();
  const t = dict.auth;
  const { bind } = useFormValues({ email: "", username: "", password: "" });
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createOwnerAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.email}</label>
        <input name="email" type="email" {...bind("email")} placeholder={t.emailPlaceholder} className={inputCls} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.username}</label>
        <input name="username" {...bind("username")} placeholder={t.usernamePlaceholder} className={inputCls} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.password}</label>
        <input
          name="password"
          type="password"
          {...bind("password")}
          placeholder={t.passwordMinPlaceholder}
          className={inputCls}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? t.creating : t.createOwner}
      </button>
    </form>
  );
}
