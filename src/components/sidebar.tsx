"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  FileText,
  FlaskConical,
  KeyRound,
  Settings,
  SlidersHorizontal,
  LogOut,
  Send,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { useI18n } from "./i18n-provider";
import { LocaleSwitcher } from "./locale-switcher";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { RoleKey } from "@/lib/constants";
import { canAccessFeature } from "@/lib/permissions";

type NavKey = keyof Dictionary["nav"];

const NAV: {
  titleKey: NavKey;
  items: { href: string; key: NavKey; icon: LucideIcon }[];
}[] = [
  { titleKey: "overview", items: [{ href: "/", key: "home", icon: LayoutDashboard }] },
  {
    titleKey: "config",
    items: [
      { href: "/channels", key: "channels", icon: Boxes },
      { href: "/templates", key: "templates", icon: FileText },
    ],
  },
  {
    titleKey: "usage",
    items: [
      { href: "/test", key: "test", icon: FlaskConical },
      { href: "/api-keys", key: "apiKeys", icon: KeyRound },
      { href: "/logs", key: "logs", icon: ScrollText },
    ],
  },
  {
    titleKey: "account",
    items: [
      { href: "/system", key: "system", icon: SlidersHorizontal },
      { href: "/settings", key: "settings", icon: Settings },
    ],
  },
];

export function Sidebar({
  userName,
  role,
  permissions,
}: {
  userName: string;
  role: string;
  permissions: string;
}) {
  const { dict } = useI18n();
  const nav = dict.nav;
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* 品牌 */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Send className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-slate-900">{nav.brandTitle}</div>
          <div className="text-[11px] text-slate-400">{nav.brandSub}</div>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {NAV.map((g) => {
          const items = g.items.filter((item) =>
            canAccessFeature({ role, permissions }, item.key),
          );
          if (items.length === 0) return null;
          return (
          <div key={g.titleKey}>
            <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {nav[g.titleKey]}
            </div>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {nav[item.key]}
                  </Link>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>

      {/* 语言切换 + 用户 + 退出 */}
      <div className="border-t border-slate-200 p-3">
        <div className="mb-2 flex justify-end px-2">
          <LocaleSwitcher />
        </div>
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-slate-800">{userName}</div>
            <div className="text-[11px] text-slate-400">
              {dict.roles[role as RoleKey] ?? role}
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title={nav.logout}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-red-500"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
