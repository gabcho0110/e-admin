import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const KEY_LEN = 64;
const SCRYPT_COST = 16384;

/** Хешира парола с scrypt (salt + параметри, съвместими с Node). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password.normalize("NFKC"), salt, KEY_LEN, { N: SCRYPT_COST }).toString(
    "hex",
  );
  return `scrypt$${SCRYPT_COST}$${salt}$${hash}`;
}

/** Проверява парола срещу записан хеш. Устойчиво на timing атаки. */
export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const salt = parts[2];
  const expected = Buffer.from(parts[3], "hex");
  if (!Number.isFinite(cost) || expected.length === 0) return false;
  const actual = scryptSync(password.normalize("NFKC"), salt, expected.length, { N: cost });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Стабилен хеш за сравнение на имейли/номера без изтичане на данни. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function newId(): string {
  return randomUUID();
}

/** Краткотраен подписан токен (използва се за междинната стъпка на 2FA). */
export function signPayload(payload: Record<string, unknown>, secret: string, ttlSeconds: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPayload<T extends Record<string, unknown>>(
  token: string | undefined,
  secret: string,
): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & {
      exp?: number;
    };
    if (!parsed.exp || parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
