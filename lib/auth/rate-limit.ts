import "server-only";

/**
 * Опростен ограничител на опитите за вход (in-memory).
 * Пази процеса от brute-force в рамките на един сървърен инстанс.
 * При хоризонтално мащабиране се заменя с Redis/Upstash — виж README.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 6;

function keyFor(identifier: string, ip: string) {
  return `${identifier.toLowerCase()}|${ip}`;
}

export function isRateLimited(identifier: string, ip: string): boolean {
  const key = keyFor(identifier, ip);
  const bucket = buckets.get(key);
  if (!bucket) return false;
  if (Date.now() > bucket.resetAt) {
    buckets.delete(key);
    return false;
  }
  return bucket.count >= MAX_ATTEMPTS;
}

export function registerFailedAttempt(identifier: string, ip: string): void {
  const key = keyFor(identifier, ip);
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.count += 1;
}

export function clearAttempts(identifier: string, ip: string): void {
  buckets.delete(keyFor(identifier, ip));
}

export function rateLimitRetryAfter(identifier: string, ip: string): number {
  const bucket = buckets.get(keyFor(identifier, ip));
  if (!bucket) return 0;
  return Math.max(0, Math.ceil((bucket.resetAt - Date.now()) / 1000));
}
