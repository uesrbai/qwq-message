// 分发相关的共享类型与工具

export type ChannelConfig = Record<string, string>;

export type DispatchPayload = {
  to?: string;
  subject?: string;
  content: string;
  variables?: Record<string, string>;
  /** 服务商侧模板编号/ID（短信必需） */
  templateCode?: string;
};

export type SendResult = { ok: boolean; error?: string; info?: string };

/** 把 {{变量}} 占位替换成实际值 */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

export function mergedVars(payload: DispatchPayload): Record<string, string> {
  return {
    ...(payload.variables ?? {}),
    content: payload.content,
    to: payload.to ?? "",
    subject: payload.subject ?? "",
  };
}
