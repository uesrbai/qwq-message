import { Send } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { LocaleSwitcher } from "@/components/locale-switcher";

export async function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { dict } = await getI18n();
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-100">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
            <Send className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200/70">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">{dict.common.tagline}</p>
      </div>
    </div>
  );
}
