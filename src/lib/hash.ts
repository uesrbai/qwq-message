import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "crypto";

// ---------- 密码哈希（scrypt，Node 内置，无需第三方原生库）----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const derived = scryptSync(password, salt, 64);
  const hashBuf = Buffer.from(hash, "hex");
  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}

// ---------- API 密钥生成与哈希 ----------

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// ---------- 可逆加密（AES-256-GCM，密钥由 AUTH_SECRET 派生）----------
// 用于「受限权限」API 密钥的重复查看；全权限密钥不加密保存。

const ENC_KEY = createHash("sha256")
  .update(process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me")
  .digest();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string | null {
  try {
    const [ivB, tagB, encB] = payload.split(".");
    const decipher = createDecipheriv("aes-256-gcm", ENC_KEY, Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encB, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** 生成一枚新密钥，返回明文（只展示这一次）、哈希、以及用于列表展示的前缀 */
export function generateApiKey(type: "TEST" | "PRODUCTION") {
  const prefix = type === "TEST" ? "qwq_test_" : "qwq_live_";
  const raw = prefix + randomBytes(24).toString("hex");
  return {
    raw,
    hash: hashApiKey(raw),
    prefix: raw.slice(0, prefix.length + 6) + "…",
  };
}
