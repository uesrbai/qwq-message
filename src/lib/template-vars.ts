// 从短信/消息模板原文里提取变量名，并生成变量 JSON 骨架
// 支持三种常见占位写法：${name}（火山/阿里）、{{name}}（本系统模板）、{name}

export function extractTemplateVars(text: string): string[] {
  const names: string[] = [];
  const push = (raw: string) => {
    const v = raw.trim();
    if (v && !names.includes(v)) names.push(v);
  };

  for (const m of text.matchAll(/\$\{\s*([^}\s]+)\s*\}/g)) push(m[1]);
  for (const m of text.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)) push(m[1]);

  // 再找单花括号 {name}，但要先去掉上面两种，避免重复/误判
  const stripped = text.replace(/\$\{[^}]*\}/g, "").replace(/\{\{[^}]*\}\}/g, "");
  for (const m of stripped.matchAll(/\{\s*([^}\s]+)\s*\}/g)) push(m[1]);

  return names;
}

/** 生成变量 JSON；已有同名值会保留 */
export function varsToJson(names: string[], existing?: Record<string, string>): string {
  const obj: Record<string, string> = {};
  for (const n of names) obj[n] = existing?.[n] ?? "";
  return JSON.stringify(obj);
}

/** 安全解析已填的变量 JSON（解析失败返回空对象） */
export function safeParseVars(raw: string): Record<string, string> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}
