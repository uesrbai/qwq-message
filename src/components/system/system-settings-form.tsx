"use client";

import { useActionState } from "react";
import { Save, CheckCircle2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { saveSystemConfigAction, type SysState } from "@/lib/actions/system";
import { useI18n } from "../i18n-provider";
import { Field, inputCls, selectCls } from "../ui/field";
import { useFormValues } from "../ui/use-form-values";

export type SysConfigView = {
  appUrl: string;
  ssoBaseUrl: string;
  ssoDefaultRole: string;
  ssoAllowedEmails: string;
  hasApiKey: boolean;
  callbackUrl: string;
};

function Copyable({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
        {text}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {done ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function SystemSettingsForm({ config }: { config: SysConfigView }) {
  const { dict } = useI18n();
  const t = dict.system;
  const { values, bind, setValues } = useFormValues({
    appUrl: config.appUrl,
    ssoBaseUrl: config.ssoBaseUrl,
    ssoApiKey: "",
    ssoDefaultRole: config.ssoDefaultRole === "IAM" ? "IAM" : "ADMIN",
    ssoAllowedEmails: config.ssoAllowedEmails,
  });
  const [state, action, pending] = useActionState<SysState, FormData>(
    saveSystemConfigAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-6">
      {/* 应用 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">{t.appSection}</h2>
        <div className="mt-4">
          <Field label={t.appUrl} help={t.appUrlHint}>
            <input name="appUrl" {...bind("appUrl")} placeholder="https://qwq-message.zeabur.app" className={inputCls} />
          </Field>
        </div>
      </div>

      {/* qwq-sso */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">{t.ssoSection}</h2>
        <div className="mt-4 space-y-4">
          <Field label={t.ssoBaseUrl}>
            <input name="ssoBaseUrl" {...bind("ssoBaseUrl")} placeholder="https://qwqsso.zeabur.app" className={inputCls} />
          </Field>

          <Field label={`${t.ssoApiKey}（${config.hasApiKey ? t.keySet : t.keyUnset}）`} help={t.ssoApiKeyHint}>
            <input
              name="ssoApiKey"
              type="password"
              {...bind("ssoApiKey")}
              placeholder={config.hasApiKey ? "••••••••" : "sk_live_..."}
              className={inputCls}
            />
          </Field>

          <Field label={t.ssoDefaultRole}>
            <select
              name="ssoDefaultRole"
              value={values.ssoDefaultRole}
              onChange={(e) => setValues((v) => ({ ...v, ssoDefaultRole: e.target.value }))}
              className={selectCls}
            >
              <option value="ADMIN">{dict.roles.ADMIN}</option>
              <option value="IAM">{dict.roles.IAM}</option>
            </select>
          </Field>

          <Field label={t.ssoAllowedEmails}>
            <input name="ssoAllowedEmails" {...bind("ssoAllowedEmails")} placeholder="a@x.com, b@x.com" className={inputCls} />
          </Field>

          {/* 回调地址提示 —— 解决"不跳回来"的关键 */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-xs text-amber-700">{t.callbackTip}</p>
            <Copyable text={config.callbackUrl} />
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">{t.envNote}</p>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state?.ok && (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          {t.saved}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {pending ? t.saving : t.save}
      </button>
    </form>
  );
}
