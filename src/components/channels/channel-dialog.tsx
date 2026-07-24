"use client";

import { useActionState, useEffect, useState } from "react";
import { Search, Copy, Check, Loader2 } from "lucide-react";
import {
  createChannelAction,
  updateChannelAction,
  queryVolcTemplatesAction,
  type FormState,
  type VolcTemplateQuery,
} from "@/lib/actions/channels";
import { useI18n } from "../i18n-provider";
import { Modal } from "../ui/modal";
import { Field, inputCls, selectCls } from "../ui/field";
import { useFormValues } from "../ui/use-form-values";
import { PROVIDERS, PROVIDER_FIELDS, pick, type MethodKey } from "@/lib/constants";

type VolcTpl = NonNullable<VolcTemplateQuery["templates"]>[number];

type ChannelEdit = {
  id: string;
  provider: string;
  name: string;
  weight: number;
  rateLimitPerMin: number | null;
  config: string;
};

function parseConfig(raw?: string): Record<string, string> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function ChannelDialog({
  open,
  onClose,
  groupId,
  method,
  edit,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  method: MethodKey;
  edit?: ChannelEdit;
}) {
  const { dict, locale } = useI18n();
  const c = dict.channels;
  const providers = PROVIDERS[method] ?? [];
  const [provider, setProvider] = useState(edit?.provider ?? providers[0]?.key ?? "");
  const { bind } = useFormValues({
    name: edit?.name ?? "",
    weight: String(edit?.weight ?? 1),
    rateLimitPerMin: edit?.rateLimitPerMin ? String(edit.rateLimitPerMin) : "",
  });
  // 各服务商的参数值（受控，报错不丢）
  const [cfg, setCfg] = useState<Record<string, string>>(() => parseConfig(edit?.config));

  // 火山「二级模板（子模板）」查询状态
  const [vtLoading, setVtLoading] = useState(false);
  const [vtErr, setVtErr] = useState("");
  const [vtList, setVtList] = useState<VolcTpl[] | null>(null);
  const [copiedId, setCopiedId] = useState("");

  async function loadVolcTemplates() {
    setVtLoading(true);
    setVtErr("");
    try {
      const r = await queryVolcTemplatesAction({
        channelId: edit?.id,
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
        region: cfg.region,
      });
      if (!r.ok) {
        setVtErr(r.error || c.volcQueryFailed);
        setVtList(null);
      } else {
        setVtList(r.templates ?? []);
      }
    } catch {
      setVtErr(c.volcQueryFailed);
      setVtList(null);
    } finally {
      setVtLoading(false);
    }
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? "" : cur)), 1500);
    } catch {
      /* 剪贴板不可用时忽略 */
    }
  }

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    edit ? updateChannelAction : createChannelAction,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state?.ok, onClose]);

  const fields = PROVIDER_FIELDS[provider] ?? [];

  return (
    <Modal open={open} onClose={onClose} title={edit ? c.editChannel : c.addChannel}>
      <form action={formAction} className="space-y-4">
        {edit && <input type="hidden" name="id" value={edit.id} />}
        <input type="hidden" name="groupId" value={groupId} />
        {/* 编辑时下拉框是 disabled 的，被禁用的控件不会提交，这里补一份值 */}
        {edit && <input type="hidden" name="provider" value={provider} />}

        <Field label={c.provider}>
          <select
            name={edit ? undefined : "provider"}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            disabled={!!edit}
            className={selectCls}
          >
            {providers.map((p) => (
              <option key={p.key} value={p.key}>
                {pick(p.label, locale)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={c.channelName}>
          <input name="name" {...bind("name")} placeholder={c.channelNamePlaceholder} className={inputCls} />
        </Field>

        <Field label={c.weight} help={c.weightHelp}>
          <input name="weight" type="number" min={1} {...bind("weight")} className={inputCls} />
        </Field>

        <Field label={c.rateLimit} help={c.rateLimitHint}>
          <input
            name="rateLimitPerMin"
            type="number"
            min={1}
            {...bind("rateLimitPerMin")}
            className={inputCls}
          />
        </Field>

        <div className="border-t border-slate-100 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {c.credentials}
        </div>

        {fields.map((f) => {
          const label = pick(f.label, locale) + (f.required ? "" : ` (${c.optional})`);
          const name = `cfg_${f.key}`;
          const value = cfg[f.key] ?? "";
          const onChange = (
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
          ) => setCfg((prev) => ({ ...prev, [f.key]: e.target.value }));
          return (
            <Field key={f.key} label={label} help={f.help ? pick(f.help, locale) : undefined}>
              {f.type === "textarea" ? (
                <textarea
                  name={name}
                  value={value}
                  onChange={onChange}
                  placeholder={f.placeholder}
                  rows={3}
                  className={inputCls}
                />
              ) : (
                <input
                  name={name}
                  type={f.type === "password" ? "password" : f.type === "number" ? "number" : "text"}
                  value={value}
                  onChange={onChange}
                  placeholder={f.placeholder}
                  className={inputCls}
                />
              )}
            </Field>
          );
        })}

        {provider === "VOLC" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-slate-500">{c.volcQueryHint}</div>
              <button
                type="button"
                onClick={loadVolcTemplates}
                disabled={vtLoading || !cfg.accessKeyId}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
              >
                {vtLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                {vtLoading ? c.volcQuerying : c.volcQueryBtn}
              </button>
            </div>

            {vtErr && <p className="mt-2 text-xs text-red-600">{vtErr}</p>}

            {vtList && vtList.length === 0 && !vtErr && (
              <p className="mt-2 text-xs text-slate-400">{c.volcNoTemplates}</p>
            )}

            {vtList && vtList.length > 0 && (
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {vtList.map((tpl) => (
                  <div key={tpl.secondTemplateId || tpl.templateId} className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                        {tpl.secondTemplateId}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyId(tpl.secondTemplateId)}
                        title={c.volcCopyId}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-50"
                      >
                        {copiedId === tpl.secondTemplateId ? (
                          <><Check className="h-3 w-3 text-emerald-600" />{c.volcCopied}</>
                        ) : (
                          <><Copy className="h-3 w-3" />{c.volcCopyId}</>
                        )}
                      </button>
                      <span
                        className={`ml-auto rounded px-1.5 py-0.5 text-[11px] ${
                          tpl.approved ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {tpl.approved ? c.volcApproved : `${c.volcNotApproved}(${tpl.reviewStatus})`}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs text-slate-600">{tpl.content}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                      {tpl.sign && <span>签名: {tpl.sign}</span>}
                      {tpl.channelType && <span>{tpl.channelType}</span>}
                      {tpl.variables.length > 0 && <span>变量: {tpl.variables.join(", ")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {c.cancel}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? c.saving : edit ? c.save : c.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}
