import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 驱动适配器：按 DATABASE_URL 自动切换
//  - 本地开发：SQLite（file:./dev.db）
//  - 线上部署：PostgreSQL（postgres://...）
// 注意：切到 Postgres 时，需把 prisma/schema.prisma 的 provider 改成
// "postgresql" 并重新 `npx prisma generate` + 迁移（见 README）。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (/^postgres(ql)?:\/\//i.test(url)) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

// 开发模式下热重载会反复创建连接，这里用全局单例避免连接爆炸
export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
