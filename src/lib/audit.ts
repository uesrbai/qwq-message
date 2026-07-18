import "server-only";
import { prisma } from "./db";

type AuditUser = { id: string; username: string; displayName: string | null } | null;

/** 记录一条后台操作（审计日志）。失败不影响主流程。 */
export async function logOperation(user: AuditUser, action: string, target?: string) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        userName: user ? user.displayName ?? user.username : null,
        action,
        target: target ?? null,
      },
    });
  } catch {
    // 审计写入失败时静默，不影响主操作
  }
}
