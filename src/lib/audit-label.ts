import type { Dictionary } from "./i18n/dictionaries";
import type { Locale } from "./i18n/config";

/** 把 "channel.create" 这样的操作码翻成可读文字（日志页与导出共用） */
export function actionLabel(dict: Dictionary, locale: Locale, code: string): string {
  const [entity, verb] = code.split(".");
  const v = dict.audit.verbs[verb as keyof Dictionary["audit"]["verbs"]] ?? verb;
  const e = dict.audit.entities[entity as keyof Dictionary["audit"]["entities"]] ?? entity;
  return locale === "zh" ? `${v}${e}` : `${v} ${e}`;
}
