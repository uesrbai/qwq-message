// IAM 权限（纯函数，服务端/客户端通用）

export const IAM_FEATURES = ["channels", "templates", "test", "apiKeys", "logs"] as const;
export type IamFeature = (typeof IAM_FEATURES)[number];

export type Permissions = { features: string[]; methods: string[] };

export function parsePermissions(json: string | null | undefined): Permissions {
  try {
    const p = JSON.parse(json || "{}");
    return {
      features: Array.isArray(p.features) ? p.features.map(String) : [],
      methods: Array.isArray(p.methods) ? p.methods.map(String) : [],
    };
  } catch {
    return { features: [], methods: [] };
  }
}

/** 某用户能否访问某功能。OWNER/ADMIN 全权限；首页与用户设置对所有人开放。 */
export function canAccessFeature(
  user: { role: string; permissions: string },
  feature: string,
): boolean {
  if (user.role !== "IAM") return true;
  if (feature === "home" || feature === "settings") return true;
  return parsePermissions(user.permissions).features.includes(feature);
}

/** 该用户可管理的分发方式列表；null 表示不限制（OWNER/ADMIN，或 IAM 未勾选）。 */
export function allowedMethods(user: { role: string; permissions: string }): string[] | null {
  if (user.role !== "IAM") return null;
  const m = parsePermissions(user.permissions).methods;
  return m.length > 0 ? m : null;
}

/** 该用户能否操作某分发方式 */
export function canUseMethod(user: { role: string; permissions: string }, method: string): boolean {
  const allowed = allowedMethods(user);
  return allowed === null || allowed.includes(method);
}
