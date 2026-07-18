// 语言配置：默认简体中文，可切 English (US)
export const LOCALES = ["zh", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALE_COOKIE = "locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: "简体中文",
  en: "English",
};

export const LOCALE_HTML_LANG: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en-US",
};

export function isLocale(v: string | undefined | null): v is Locale {
  return v === "zh" || v === "en";
}
