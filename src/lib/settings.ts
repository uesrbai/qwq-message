import "server-only";
import { prisma } from "./db";

/** 读取系统设置（JSON 值），不存在返回 fallback */
export async function getSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const v = JSON.stringify(value);
  await prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
}

export const DEFAULT_TEST_RATE_LIMIT_KEY = "default_test_rate_limit";

/** 测试密钥默认限速（每分钟次数），平台管理员可设定 */
export async function getDefaultTestRateLimit(): Promise<number> {
  return getSetting<number>(DEFAULT_TEST_RATE_LIMIT_KEY, 60);
}
