"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Power, Boxes, ScrollText } from "lucide-react";
import { useI18n } from "../i18n-provider";
import {
  providerLabel,
  METHOD_KEYS,
  type MethodKey,
  type StrategyKey,
} from "@/lib/constants";
import { GroupDialog } from "./group-dialog";
import { ChannelDialog } from "./channel-dialog";
import {
  deleteGroupAction,
  setGroupEnabledAction,
  deleteChannelAction,
  setChannelEnabledAction,
} from "@/lib/actions/channels";

export type ChannelDTO = {
  id: string;
  provider: string;
  name: string;
  config: string;
  enabled: boolean;
  weight: number;
  rateLimitPerMin: number | null;
};
export type GroupDTO = {
  id: string;
  method: string;
  code: string;
  name: string;
  strategy: string;
  enabled: boolean;
  channels: ChannelDTO[];
};

const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700";

export function ChannelsView({
  groups,
  allowedMethods,
}: {
  groups: GroupDTO[];
  allowedMethods: string[] | null;
}) {
  const { dict, locale } = useI18n();
  const c = dict.channels;
  const methodKeys = allowedMethods
    ? METHOD_KEYS.filter((m) => allowedMethods.includes(m))
    : METHOD_KEYS;
  const defaultMethod: MethodKey = methodKeys[0] ?? "SMS";
  const [activeMethod, setActiveMethod] = useState<MethodKey | "ALL">("ALL");
  const [groupDialog, setGroupDialog] = useState<{ open: boolean; edit?: GroupDTO; method: MethodKey }>({
    open: false,
    method: "SMS",
  });
  const [channelDialog, setChannelDialog] = useState<{
    open: boolean;
    groupId: string;
    method: MethodKey;
    edit?: ChannelDTO;
  }>({ open: false, groupId: "", method: "SMS" });

  const filtered = activeMethod === "ALL" ? groups : groups.filter((g) => g.method === activeMethod);
  const allLabel = locale === "zh" ? "全部" : "All";

  const openNewGroup = () =>
    setGroupDialog({ open: true, method: activeMethod === "ALL" ? defaultMethod : activeMethod });
  const openEditGroup = (g: GroupDTO) =>
    setGroupDialog({ open: true, edit: g, method: g.method as MethodKey });
  const openAddChannel = (g: GroupDTO) =>
    setChannelDialog({ open: true, groupId: g.id, method: g.method as MethodKey });
  const openEditChannel = (g: GroupDTO, ch: ChannelDTO) =>
    setChannelDialog({ open: true, groupId: g.id, method: g.method as MethodKey, edit: ch });

  return (
    <div>
      {/* 方式筛选 + 新建分组 */}
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
        <button onClick={openNewGroup} className={btnPrimary}>
          <Plus className="h-4 w-4" />
          {c.newGroup}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Boxes className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm text-slate-400">{c.noGroups}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              onEdit={() => openEditGroup(g)}
              onAddChannel={() => openAddChannel(g)}
              onEditChannel={(ch) => openEditChannel(g, ch)}
            />
          ))}
        </div>
      )}

      {groupDialog.open && (
        <GroupDialog
          open
          onClose={() => setGroupDialog((s) => ({ ...s, open: false }))}
          edit={groupDialog.edit}
          defaultMethod={groupDialog.method}
          allowedMethods={allowedMethods}
        />
      )}
      {channelDialog.open && (
        <ChannelDialog
          open
          onClose={() => setChannelDialog((s) => ({ ...s, open: false }))}
          groupId={channelDialog.groupId}
          method={channelDialog.method}
          edit={channelDialog.edit}
        />
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function GroupCard({
  group,
  onEdit,
  onAddChannel,
  onEditChannel,
}: {
  group: GroupDTO;
  onEdit: () => void;
  onAddChannel: () => void;
  onEditChannel: (ch: ChannelDTO) => void;
}) {
  const { dict, locale } = useI18n();
  const c = dict.channels;

  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${group.enabled ? "" : "opacity-70"}`}>
      {/* 头部 */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
              {dict.methods[group.method as MethodKey] ?? group.method}
            </span>
            <span className="truncate text-sm font-semibold text-slate-900">{group.name}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{group.code}</code>
            <span>·</span>
            <span>{dict.strategies[group.strategy as StrategyKey] ?? group.strategy}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/logs?group=${encodeURIComponent(group.code)}`}
            title={c.viewLogs}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <ScrollText className="h-4 w-4" />
          </Link>
          <form action={setGroupEnabledAction}>
            <input type="hidden" name="id" value={group.id} />
            <input type="hidden" name="enabled" value={(!group.enabled).toString()} />
            <button
              type="submit"
              title={group.enabled ? c.disable : c.enable}
              className={`rounded-lg p-1.5 ${
                group.enabled ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-300 hover:bg-slate-100"
              }`}
            >
              <Power className="h-4 w-4" />
            </button>
          </form>
          <button
            onClick={onEdit}
            title={c.edit}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <form
            action={deleteGroupAction}
            onSubmit={(e) => {
              if (!confirm(c.confirmDeleteGroup)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={group.id} />
            <button
              type="submit"
              title={c.delete}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* 渠道列表 */}
      <div className="p-3">
        {group.channels.length === 0 ? (
          <p className="px-1 py-3 text-center text-xs text-slate-400">{c.noChannels}</p>
        ) : (
          <div className="space-y-2">
            {group.channels.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${ch.enabled ? "bg-emerald-500" : "bg-slate-300"}`}
                    />
                    <span className="truncate text-sm font-medium text-slate-800">{ch.name}</span>
                  </div>
                  <div className="mt-0.5 pl-3.5 text-xs text-slate-400">
                    {providerLabel(ch.provider, locale)} · {c.weight} {ch.weight}
                    {ch.rateLimitPerMin ? ` · ${ch.rateLimitPerMin} ${dict.apiKeys.perMin}` : ""}
                    {!ch.enabled ? ` · ${c.disabledTag}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <form action={setChannelEnabledAction}>
                    <input type="hidden" name="id" value={ch.id} />
                    <input type="hidden" name="enabled" value={(!ch.enabled).toString()} />
                    <button
                      type="submit"
                      title={ch.enabled ? c.disable : c.enable}
                      className={`rounded p-1 ${
                        ch.enabled ? "text-emerald-500 hover:bg-emerald-100" : "text-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                  </form>
                  <button
                    onClick={() => onEditChannel(ch)}
                    title={c.edit}
                    className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <form
                    action={deleteChannelAction}
                    onSubmit={(e) => {
                      if (!confirm(c.confirmDeleteChannel)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={ch.id} />
                    <button
                      type="submit"
                      title={c.delete}
                      className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={onAddChannel}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-sm font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
        >
          <Plus className="h-4 w-4" />
          {c.addChannel}
        </button>
      </div>
    </div>
  );
}
