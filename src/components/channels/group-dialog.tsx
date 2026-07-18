"use client";

import { useActionState, useEffect } from "react";
import { createGroupAction, updateGroupAction, type FormState } from "@/lib/actions/channels";
import { useI18n } from "../i18n-provider";
import { Modal } from "../ui/modal";
import { Field, inputCls, selectCls } from "../ui/field";
import { useFormValues } from "../ui/use-form-values";
import { METHOD_KEYS, STRATEGY_KEYS, type MethodKey } from "@/lib/constants";

type GroupEdit = {
  id: string;
  method: string;
  name: string;
  code: string;
  strategy: string;
};

export function GroupDialog({
  open,
  onClose,
  edit,
  defaultMethod,
  allowedMethods,
}: {
  open: boolean;
  onClose: () => void;
  edit?: GroupEdit;
  defaultMethod: MethodKey;
  allowedMethods: string[] | null;
}) {
  const { dict } = useI18n();
  const c = dict.channels;
  const methodKeys = allowedMethods
    ? METHOD_KEYS.filter((m) => allowedMethods.includes(m))
    : METHOD_KEYS;

  const { values, bind } = useFormValues({
    method: edit?.method ?? defaultMethod,
    name: edit?.name ?? "",
    code: edit?.code ?? "",
    strategy: edit?.strategy ?? "ROUND_ROBIN",
  });

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    edit ? updateGroupAction : createGroupAction,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state?.ok, onClose]);

  return (
    <Modal open={open} onClose={onClose} title={edit ? c.editGroup : c.newGroup}>
      <form action={formAction} className="space-y-4">
        {edit && <input type="hidden" name="id" value={edit.id} />}
        {/* 编辑时下拉框 disabled 不会提交，这里补一份 */}
        {edit && <input type="hidden" name="method" value={values.method} />}

        <Field label={c.method}>
          <select
            name={edit ? undefined : "method"}
            {...bind("method")}
            disabled={!!edit}
            className={selectCls}
          >
            {methodKeys.map((m) => (
              <option key={m} value={m}>
                {dict.methods[m]}
              </option>
            ))}
          </select>
        </Field>

        <Field label={c.groupName}>
          <input name="name" {...bind("name")} placeholder={c.groupNamePlaceholder} className={inputCls} />
        </Field>

        <Field label={c.groupCode} help={c.groupCodeHelp}>
          <input name="code" {...bind("code")} placeholder={c.groupCodePlaceholder} className={inputCls} />
        </Field>

        <Field label={c.strategy}>
          <select name="strategy" {...bind("strategy")} className={selectCls}>
            {STRATEGY_KEYS.map((s) => (
              <option key={s} value={s}>
                {dict.strategies[s]}
              </option>
            ))}
          </select>
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
