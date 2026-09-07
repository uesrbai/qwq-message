"use client";

import { useState, useTransition } from "react";
import { FolderPlus, Folder, Pencil, Trash2, Check, X } from "lucide-react";
import { useI18n } from "../i18n-provider";
import {
  createFolderAction,
  renameFolderAction,
  deleteFolderAction,
  moveToFolderAction,
  type FolderKind,
} from "@/lib/actions/folders";

export type FolderDTO = { id: string; name: string; scopeId?: string | null };

/** 把带 folderId 的项按文件夹分区：返回 [{folder, items}...] + 未分类 */
export function groupByFolder<T extends { folderId?: string | null }>(
  items: T[],
  folders: FolderDTO[],
): { folder: FolderDTO | null; items: T[] }[] {
  const sections: { folder: FolderDTO | null; items: T[] }[] = folders.map((f) => ({
    folder: f,
    items: items.filter((it) => it.folderId === f.id),
  }));
  const known = new Set(folders.map((f) => f.id));
  const uncategorized = items.filter((it) => !it.folderId || !known.has(it.folderId));
  sections.push({ folder: null, items: uncategorized });
  return sections;
}

/** 新建文件夹按钮（点开变输入框）；compact 用于卡片内部的小尺寸样式 */
export function NewFolderButton({
  kind,
  scopeId,
  compact,
}: {
  kind: FolderKind;
  scopeId?: string;
  compact?: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.folders;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
            : "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        }
      >
        <FolderPlus className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {t.newFolder}
      </button>
    );
  }
  const submit = () => {
    if (!name.trim()) return;
    start(async () => {
      await createFolderAction(kind, name, scopeId);
      setName("");
      setOpen(false);
    });
  };
  return (
    <div className="inline-flex items-center gap-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={t.namePlaceholder}
        className="w-52 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
      />
      <button
        onClick={submit}
        disabled={pending}
        className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        <Check className="h-4 w-4" />
      </button>
      <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** 文件夹分区标题（含重命名/删除） */
export function FolderHeader({
  folder,
  count,
}: {
  folder: FolderDTO | null;
  count: number;
}) {
  const { dict } = useI18n();
  const t = dict.folders;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder?.name ?? "");
  const [pending, start] = useTransition();

  const rename = () => {
    if (!folder || !name.trim()) return;
    start(async () => {
      await renameFolderAction(folder.id, name);
      setEditing(false);
    });
  };
  const remove = () => {
    if (!folder) return;
    if (!confirm(t.confirmDelete)) return;
    start(async () => {
      await deleteFolderAction(folder.id);
    });
  };

  return (
    <div className="mb-2 mt-4 flex items-center gap-2 first:mt-0">
      <Folder className={`h-4 w-4 ${folder ? "text-indigo-500" : "text-slate-400"}`} />
      {editing && folder ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") rename();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-44 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
          />
          <button onClick={rename} disabled={pending} className="rounded p-1 text-emerald-600 hover:bg-emerald-50">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setEditing(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <span className="text-sm font-semibold text-slate-700">
            {folder ? folder.name : t.uncategorized}
          </span>
          <span className="text-xs text-slate-400">({count})</span>
          {folder && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => {
                  setName(folder.name);
                  setEditing(true);
                }}
                title={t.rename}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={remove}
                disabled={pending}
                title={t.delete}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      )}
      <div className="ml-1 h-px flex-1 bg-slate-100" />
    </div>
  );
}

/** 把某个项移动到某文件夹的下拉选择 */
export function MoveToFolderSelect({
  kind,
  itemId,
  currentFolderId,
  folders,
}: {
  kind: FolderKind;
  itemId: string;
  currentFolderId: string | null | undefined;
  folders: FolderDTO[];
}) {
  const { dict } = useI18n();
  const t = dict.folders;
  const [pending, start] = useTransition();

  if (folders.length === 0) return null;
  return (
    <select
      value={currentFolderId ?? ""}
      disabled={pending}
      title={t.moveTo}
      onChange={(e) => {
        const v = e.target.value;
        start(async () => {
          await moveToFolderAction(kind, itemId, v || undefined);
        });
      }}
      className="max-w-[8rem] truncate rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-500 outline-none hover:border-slate-300"
    >
      <option value="">{t.uncategorized}</option>
      {folders.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  );
}
