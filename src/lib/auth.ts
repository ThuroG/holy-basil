import crypto from 'node:crypto';

/**
 * Crew authentication for /admin and all crew-only API routes.
 *
 * - The crew PIN comes from the env variable CREW_PIN.
 * - Without CREW_PIN a random PIN is generated at startup and printed to the console,
 *   so the app is never reachable with a well-known default password.
 * - A successful login creates a random session token that is stored in an HttpOnly cookie.
 */

export const CREW_COOKIE_NAME = 'hb_crew';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // one long shift
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

let crewPin: string | null = null;
let pinWasGenerated = false;

const sessions = new Map<string, number>(); // token -> expiresAt
const attempts = new Map<string, { count: number; windowStart: number }>();

export function getCrewPin(): string {
  if (crewPin === null) {
    const fromEnv = (process.env.CREW_PIN || '').trim();
    if (fromEnv.length >= 4) {
      crewPin = fromEnv;
      pinWasGenerated = false;
    } else {
      crewPin = String(crypto.randomInt(100000, 1000000));
      pinWasGenerated = true;
    }
  }
  return crewPin;
}

export function wasCrewPinGenerated(): boolean {
  getCrewPin();
  return pinWasGenerated;
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export type LoginResult =
  | { ok: true; token: string; maxAgeSeconds: number }
  | { ok: false; reason: 'WRONG_PIN' | 'TOO_MANY_ATTEMPTS' };

export function loginCrew(pin: unknown, clientKey = 'unknown', now = Date.now()): LoginResult {
  const entry = attempts.get(clientKey);
  if (entry && now - entry.windowStart > ATTEMPT_WINDOW_MS) {
    attempts.delete(clientKey);
  }
  const current = attempts.get(clientKey);
  if (current && current.count >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
  }

  if (typeof pin !== 'string' || !safeEqual(pin.trim(), getCrewPin())) {
    if (current) {
      current.count += 1;
    } else {
      attempts.set(clientKey, { count: 1, windowStart: now });
    }
    return { ok: false, reason: 'WRONG_PIN' };
  }

  attempts.delete(clientKey);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, now + SESSION_TTL_MS);
  return { ok: true, token, maxAgeSeconds: Math.floor(SESSION_TTL_MS / 1000) };
}

export function isCrewSession(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= now) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function logoutCrew(token: string | undefined): void {
  if (token) sessions.delete(token);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

export function buildCrewCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  return `${CREW_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

export function buildClearCrewCookie(): string {
  return `${CREW_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

/** Test helper. */
export function resetAuth(pin?: string): void {
  sessions.clear();
  attempts.clear();
  crewPin = pin ?? null;
  pinWasGenerated = false;
}
