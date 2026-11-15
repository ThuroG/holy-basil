/**
 * Small in-memory rate limiter (fixed window per client and bucket).
 * It protects the Züri-Code pool and the data files from being flooded by one client.
 *
 * The limits are generous on purpose: guests on the same mobile carrier or the same
 * festival WiFi can share one public address.
 */

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

function fromEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const RATE_LIMITS = {
  orders: (): RateLimitRule => ({ limit: fromEnv('RATE_LIMIT_ORDERS', 30), windowMs: 5 * 60 * 1000 }),
  newsletter: (): RateLimitRule => ({ limit: fromEnv('RATE_LIMIT_FORMS', 5), windowMs: 10 * 60 * 1000 }),
  b2b: (): RateLimitRule => ({ limit: fromEnv('RATE_LIMIT_FORMS', 5), windowMs: 10 * 60 * 1000 }),
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

const windows = new Map<string, { count: number; windowStart: number }>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  bucket: RateLimitBucket,
  clientKey = 'unknown',
  now: number = Date.now()
): RateLimitResult {
  const rule = RATE_LIMITS[bucket]();
  const key = `${bucket}:${clientKey}`;
  const entry = windows.get(key);
  if (!entry || now - entry.windowStart >= rule.windowMs) {
    windows.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= rule.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.windowStart + rule.windowMs - now) / 1000)),
    };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Drops expired windows so the map cannot grow without bound. */
export function pruneRateLimits(now: number = Date.now()): void {
  const longest = 10 * 60 * 1000;
  for (const [key, entry] of windows) {
    if (now - entry.windowStart >= longest) windows.delete(key);
  }
}

export function resetRateLimits(): void {
  windows.clear();
}
