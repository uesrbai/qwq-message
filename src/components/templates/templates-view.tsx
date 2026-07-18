"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Power, FileText } from "lucide-react";
import { useI18n } from "../i18n-provider";
import { METHOD_KEYS, type MethodKey } from "@/lib/constants";
import { TemplateDialog, type GroupOpt, type TemplateEdit } from "./template-dialog";
import { deleteTemplateAction, setTemplateEnabledAction } from "@/lib/actions/templates";

export type TemplateDTO = TemplateEdit & { groupName: string | null; enabled: boolean };

export function TemplatesView({
  templates,
  groups,
  allowedMethods,
}: {
  templates: TemplateDTO[];
  groups: GroupOpt[];
  allowedMethods: string[] | null;
}) {
  const { dict, locale } = useI18n();
  const t = dict.templates;
  const methodKeys = allowedMethods
    ? METHOD_KEYS.filter((m) => allowedMethods.includes(m))
    : METHOD_KEYS;
  const defaultMethod: MethodKey = methodKeys[0] ?? "EMAIL";
  const [activeMethod, setActiveMethod] = useState<MethodKey | "ALL">("ALL");
  const [dialog, setDialog] = useState<{ open: boolean; edit?: TemplateDTO; method: MethodKey }>({
    open: false,
    method: "EMAIL",
  });

  const filtered = activeMethod === "ALL" ? templates : templates.filter((x) => x.method === activeMethod);
  const allLabel = locale === "zh" ? "全部" : "All";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Tab active={activeMethod === "ALL"} onClick={() => setActiveMethod("ALL")}>
            {allLabel}
          </Tab>
          {methodKeys.map((m) => (
            <Tab key={m} active={activeMethod === m} onClick={() => setActiveMethod(m)}>
              {dict.methods[m]}
            </Tab>
          ))}
        </div>
        <button
          onClick={() =>
            setDialog({ open: true, method: activeMethod === "ALL" ? defaultMethod : activeMethod })
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          {t.newTemplate}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileText className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm text-slate-400">{t.noTemplates}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              onEdit={() => setDialog({ open: true, edit: tpl, method: tpl.method as MethodKey })}
            />
          ))}
        </div>
      )}

      {dialog.open && (
        <TemplateDialog
          open
          onClose={() => setDialog((s) => ({ ...s, open: false }))}
          edit={dialog.edit}
          groups={groups}
          defaultMethod={dialog.method}
          allowedMethods={allowedMethods}
        />
      )}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function TemplateCard({ tpl, onEdit }: { tpl: TemplateDTO; onEdit: () => void }) {
  const { dict } = useI18n();
  const t = dict.templates;
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 ${tpl.enabled ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
              {dict.methods[tpl.method as MethodKey] ?? tpl.method}
            </span>
            <span className="truncate text-sm font-semibold text-slate-900">{tpl.name}</span>
            {!tpl.enabled && <span className="text-xs text-slate-400">· {t.disabledTag}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{tpl.code}</code>
            {tpl.groupName && (
              <>
                <span>·</span>
                <span>
                  {t.groupLabel}: {tpl.groupName}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <form action={setTemplateEnabledAction}>
            <input type="hidden" name="id" value={tpl.id} />
            <input type="hidden" name="enabled" value={(!tpl.enabled).toString()} />
            <button
              type="submit"
              title={tpl.enabled ? t.disable : t.enable}
              className={`rounded-lg p-1.5 ${
                tpl.enabled ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-300 hover:bg-slate-100"
              }`}
            >
              <Power className="h-4 w-4" />
            </button>
          </form>
          <button
            onClick={onEdit}
            title={t.edit}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <form
            action={deleteTemplateAction}
            onSubmit={(e) => {
              if (!confirm(t.confirmDelete)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={tpl.id} />
            <button
              type="submit"
              title={t.delete}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
      {tpl.content && (
        <p className="mt-2 line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {tpl.content}
        </p>
      )}
    </div>
  );
}
