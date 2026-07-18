"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { useI18n } from "./i18n-provider";

const SHORT: Record<Locale, string> = { zh: "中", en: "EN" };

export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  function change(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    start(() => router.refresh());
  }

  return (
    <div
      className={`inline-flex rounded-lg border border-slate-200 bg-white p-0.5 ${className ?? ""}`}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          disabled={pending}
          className={`rounded-md px-2 py-1 text-xs font-medium transition ${
            l === locale
              ? "bg-slate-900 text-white"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}
