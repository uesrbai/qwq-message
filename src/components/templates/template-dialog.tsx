"use client";

import { useActionState, useEffect } from "react";
import {
  createTemplateAction,
  updateTemplateAction,
  type FormState,
} from "@/lib/actions/templates";
import { useI18n } from "../i18n-provider";
import { Modal } from "../ui/modal";
import { Field, inputCls, selectCls } from "../ui/field";
import { useFormValues } from "../ui/use-form-values";
import { METHOD_KEYS, type MethodKey } from "@/lib/constants";
import { extractTemplateVars } from "@/lib/template-vars";

export type GroupOpt = { id: string; name: string; method: string; code: string };
export type TemplateEdit = {
  id: string;
  code: string;
  name: string;
  method: string;
  groupId: string | null;
  subject: string | null;
  content: string;
  signName: string | null;
  providerTemplateId: string | null;
  variables: string;
};

export function TemplateDialog({
  open,
  onClose,
  edit,
  groups,
  defaultMethod,
  allowedMethods,
}: {
  open: boolean;
  onClose: () => void;
  edit?: TemplateEdit;
  groups: GroupOpt[];
  defaultMethod: MethodKey;
  allowedMethods: string[] | null;
}) {
  const { dict } = useI18n();
  const t = dict.templates;
  const methodKeys = allowedMethods
    ? METHOD_KEYS.filter((m) => allowedMethods.includes(m))
    : METHOD_KEYS;

  const { values, setValues, bind } = useFormValues({
    code: edit?.code ?? "",
    name: edit?.name ?? "",
    method: edit?.method ?? defaultMethod,
    groupId: edit?.groupId ?? "",
    subject: edit?.subject ?? "",
    providerTemplateId: edit?.providerTemplateId ?? "",
    signName: edit?.signName ?? "",
    content: edit?.content ?? "",
  });

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    edit ? updateTemplateAction : createTemplateAction,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state?.ok, onClose]);

  const groupOpts = groups.filter((g) => g.method === values.method);
  const detectedVars = extractTemplateVars(values.content);
  const isSms = values.method === "SMS";
  const isEmail = values.method === "EMAIL";

  return (
    <Modal open={open} onClose={onClose} title={edit ? t.editTemplate : t.newTemplate}>
      <form action={formAction} className="space-y-4">
        {edit && <input type="hidden" name="id" value={edit.id} />}

        <Field label={t.code} help={t.codeHelp}>
          <input name="code" {...bind("code")} placeholder={t.codePlaceholder} className={inputCls} />
        </Field>
        <Field label={t.name}>
          <input name="name" {...bind("name")} placeholder={t.namePlaceholder} className={inputCls} />
        </Field>
        <Field label={t.method}>
          <select
            name="method"
            value={values.method}
            onChange={(e) =>
              // 换分发方式时清掉不匹配的绑定分组
              setValues((v) => ({ ...v, method: e.target.value, groupId: "" }))
            }
            className={selectCls}
          >
            {methodKeys.map((m) => (
              <option key={m} value={m}>
                {dict.methods[m]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.group}>
          <select name="groupId" {...bind("groupId")} className={selectCls}>
            <option value="">{t.groupAuto}</option>
            {groupOpts.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}（{g.code}）
              </option>
            ))}
          </select>
        </Field>

        {isEmail && (
          <Field label={t.subject}>
            <input name="subject" {...bind("subject")} className={inputCls} />
          </Field>
        )}
        {isSms && (
          <Field label={t.providerTemplateId} help={t.providerTemplateIdHelp}>
            <input name="providerTemplateId" {...bind("providerTemplateId")} className={inputCls} />
          </Field>
        )}
        {isSms && (
          <Field label={t.signName}>
            <input name="signName" {...bind("signName")} className={inputCls} />
          </Field>
        )}

        <Field label={t.content}>
          <textarea
            name="content"
            rows={4}
            {...bind("content")}
            placeholder={t.contentPlaceholder}
            className={inputCls}
          />
        </Field>
        <Field label={t.variablesAuto} help={t.variablesAutoHelp}>
          {detectedVars.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">
              {t.variablesAutoNone}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 rounded-lg bg-slate-50 px-3 py-2">
              {detectedVars.map((v) => (
                <code
                  key={v}
                  className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600"
                >
                  {v}
                </code>
              ))}
            </div>
          )}
        </Field>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? t.saving : edit ? t.save : t.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}
