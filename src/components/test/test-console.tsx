"use client";

import { useActionState, useState } from "react";
import { Send, CheckCircle2, XCircle, FlaskConical, Wand2, ChevronDown } from "lucide-react";
import { useI18n } from "../i18n-provider";
import { Field, inputCls, selectCls } from "../ui/field";
import { useFormValues } from "../ui/use-form-values";
import { providerLabel, type MethodKey } from "@/lib/constants";
import { extractTemplateVars, varsToJson, safeParseVars } from "@/lib/template-vars";
import { interpolate } from "@/lib/i18n/dictionaries";
import { testSendAction, type TestResult } from "@/lib/actions/test";

type ChannelOpt = { id: string; name: string; provider: string; groupName: string };
type TemplateOpt = {
  code: string;
  name: string;
  method: string;
  variables: string;
  content: string;
};

function templateVars(tpl?: TemplateOpt): string[] {
  if (!tpl) return [];
  try {
    const v = JSON.parse(tpl.variables || "[]") as string[];
    if (v.length > 0) return v;
  } catch {
    /* 忽略 */
  }
  return extractTemplateVars(tpl.content || "");
}

function ModeCard({
  checked,
  onClick,
  label,
  hint,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-left transition ${
        checked
          ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
          : "border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className={`text-sm font-medium ${checked ? "text-indigo-700" : "text-slate-700"}`}>
        {label}
      </div>
      <div className="mt-0.5 text-xs text-slate-400">{hint}</div>
    </button>
  );
}

export function TestConsole({
  channels,
  templates,
}: {
  channels: ChannelOpt[];
  templates: TemplateOpt[];
}) {
  const { dict, locale } = useI18n();
  const t = dict.test;
  const [state, action, pending] = useActionState<TestResult, FormData>(testSendAction, undefined);

  const [mode, setMode] = useState<"CHANNEL" | "TEMPLATE">("CHANNEL");
  const { bind } = useFormValues({ to: "", content: "", subject: "", templateCode: "" });
  const [tplCode, setTplCode] = useState(templates[0]?.code ?? "");
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [variables, setVariables] = useState("");
  const [helperOpen, setHelperOpen] = useState(false);
  const [tplText, setTplText] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  const selectedTpl = templates.find((x) => x.code === tplCode);
  const tplVars = templateVars(selectedTpl);

  function handleExtract() {
    const names = extractTemplateVars(tplText);
    if (names.length === 0) {
      setHint(t.extractNone);
      return;
    }
    setVariables(varsToJson(names, safeParseVars(variables)));
    setHint(interpolate(t.extractDone, { n: names.length }));
  }

  if (channels.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <FlaskConical className="h-6 w-6" />
        </div>
        <p className="mt-4 text-sm text-slate-400">{t.noChannels}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <input type="hidden" name="mode" value={mode} />

        <Field label={t.modeLabel}>
          <div className="flex gap-2">
            <ModeCard
              checked={mode === "CHANNEL"}
              onClick={() => setMode("CHANNEL")}
              label={t.modeChannel}
              hint={t.modeChannelHint}
            />
            <ModeCard
              checked={mode === "TEMPLATE"}
              onClick={() => setMode("TEMPLATE")}
              label={t.modeTemplate}
              hint={t.modeTemplateHint}
            />
          </div>
        </Field>

        {mode === "CHANNEL" ? (
          <>
            <Field label={t.selectChannel}>
              <select name="channelId" defaultValue={channels[0].id} className={selectCls}>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.groupName} › {ch.name}（{providerLabel(ch.provider, locale)}）
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.to}>
              <input name="to" {...bind("to")} placeholder={t.toPlaceholder} className={inputCls} />
            </Field>
            <Field label={t.content}>
              <textarea name="content" rows={3} {...bind("content")} placeholder={t.contentPlaceholder} className={inputCls} />
            </Field>
            <Field label={t.subject}>
              <input name="subject" {...bind("subject")} placeholder={t.subjectPlaceholder} className={inputCls} />
            </Field>
            <Field label={t.templateCode}>
              <input name="templateCode" {...bind("templateCode")} placeholder={t.templateCodePlaceholder} className={inputCls} />
            </Field>

            <Field label={t.variables}>
              <textarea
                name="variables"
                rows={2}
                value={variables}
                onChange={(e) => setVariables(e.target.value)}
                placeholder={t.variablesPlaceholder}
                className={inputCls}
              />
            </Field>

            {/* 模板 → JSON 助手（仅按渠道测试时需要手填 JSON）*/}
            <div className="rounded-lg border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setHelperOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <Wand2 className="h-4 w-4 text-indigo-500" />
                {t.varsHelper}
                <ChevronDown className={`ml-auto h-4 w-4 transition ${helperOpen ? "rotate-180" : ""}`} />
              </button>
              {helperOpen && (
                <div className="space-y-2 border-t border-slate-200 p-3">
                  <p className="text-xs text-slate-500">{t.varsHelperHint}</p>
                  <textarea
                    rows={3}
                    value={tplText}
                    onChange={(e) => setTplText(e.target.value)}
                    placeholder={t.varsHelperPlaceholder}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={handleExtract}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    {t.extractBtn}
                  </button>
                  {hint && <p className="text-xs text-indigo-600">{hint}</p>}
                </div>
              )}
            </div>
          </>
        ) : templates.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{t.noTemplatesTest}</p>
        ) : (
          <>
            <Field label={t.selectTemplate}>
              <select
                name="tplCode"
                value={tplCode}
                onChange={(e) => {
                  setTplCode(e.target.value);
                  setVarValues({});
                }}
                className={selectCls}
              >
                {templates.map((tp) => (
                  <option key={tp.code} value={tp.code}>
                    {dict.methods[tp.method as MethodKey] ?? tp.method} › {tp.name}（{tp.code}）
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.to}>
              <input name="to" {...bind("to")} placeholder={t.toPlaceholder} className={inputCls} />
            </Field>

            {/* 模板变量：逐个填，不用写 JSON */}
            <Field label={t.varsFromTemplate} help={tplVars.length > 0 ? t.varsFromTemplateHelp : undefined}>
              {tplVars.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">{t.varsNone}</p>
              ) : (
                <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                  {tplVars.map((v) => (
                    <div key={v} className="flex items-center gap-2">
                      <code className="w-32 shrink-0 truncate rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
                        {v}
                      </code>
                      <input
                        name={`var_${v}`}
                        value={varValues[v] ?? ""}
                        onChange={(e) => setVarValues((p) => ({ ...p, [v]: e.target.value }))}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  ))}
                </div>
              )}
            </Field>
          </>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {pending ? t.sending : t.send}
        </button>
      </form>

      <div>
        {state ? (
          <div
            className={`rounded-xl border p-5 ${
              state.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-center gap-2">
              {state.ok ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className={`font-semibold ${state.ok ? "text-emerald-700" : "text-red-700"}`}>
                {state.ok ? t.resultSuccess : t.resultFailed}
              </span>
            </div>
            {state.channelName && (
              <p className="mt-2 text-sm text-slate-600">
                {t.usedChannel}: <span className="font-medium">{state.channelName}</span>
              </p>
            )}
            {state.error && <p className="mt-1 text-sm text-red-600">{state.error}</p>}
            {state.detail && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-medium text-slate-500">{t.response}</div>
                <pre className="max-h-48 overflow-auto rounded-lg bg-white/70 p-2 text-xs text-slate-600">
                  {state.detail}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            {t.hint}
          </div>
        )}
      </div>
    </div>
  );
}
