"use client";

import { Hammer } from "lucide-react";
import { useI18n } from "./i18n-provider";

export function ComingSoon({ note }: { note?: string }) {
  const { dict } = useI18n();
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
        <Hammer className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-700">{dict.comingSoon.title}</p>
      {note && <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">{note}</p>}
    </div>
  );
}
