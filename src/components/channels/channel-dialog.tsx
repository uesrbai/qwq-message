"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createChannelAction,
  updateChannelAction,
  type FormState,
} from "@/lib/actions/channels";
import { useI18n } from "../i18n-provider";
import { Modal } from "../ui/modal";
import { Field, inputCls, selectCls } from "../ui/field";
import { useFormValues } from "../ui/use-form-values";
import { PROVIDERS, PROVIDER_FIELDS, pick, type MethodKey } from "@/lib/constants";

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
