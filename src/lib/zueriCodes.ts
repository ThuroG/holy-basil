import { ZueriCodeAssignment } from './types.js';

export interface ZueriCodeEntry {
  plz: string;
  quarter: string;
  slang?: string;
}

export const ZUERI_CODE_POOL: readonly ZueriCodeEntry[] = [
  { plz: '8001', quarter: 'NIEDERDORF', slang: 'DÖRFLI' },
  { plz: '8002', quarter: 'ENGE' },
  { plz: '8003', quarter: 'WIEDIKON', slang: 'CHREIS 3' },
  { plz: '8004', quarter: 'LANGSTRASSE', slang: 'CHREIS CHEIB' },
  { plz: '8005', quarter: 'ZÜRI WEST', slang: 'INDUSTRIE' },
  { plz: '8006', quarter: 'UNTERSTRASS' },
  { plz: '8008', quarter: 'SEEFELD' },
  { plz: '8032', quarter: 'HOTTINGEN' },
  { plz: '8037', quarter: 'WIPKINGEN' },
  { plz: '8038', quarter: 'WOLLISHOFEN' },
  { plz: '8041', quarter: 'LEIMBACH' },
  { plz: '8044', quarter: 'FLUNTERN', slang: 'ZÜRIBERG' },
  { plz: '8045', quarter: 'GIESSHÜBEL', slang: 'SIHLCITY' },
  { plz: '8046', quarter: 'AFFOLTERN' },
  { plz: '8047', quarter: 'ALBISRIEDEN' },
  { plz: '8048', quarter: 'ALTSTETTEN' },
  { plz: '8049', quarter: 'HÖNGG' },
  { plz: '8050', quarter: 'OERLIKON', slang: 'CHREIS 11' },
  { plz: '8051', quarter: 'SCHWAMENDINGEN' },
  { plz: '8052', quarter: 'SEEBACH' },
  { plz: '8053', quarter: 'WITIKON' },
  { plz: '8055', quarter: 'FRIESENBERG' },
  { plz: '8057', quarter: 'MILCHBUCK' },
  { plz: '8064', quarter: 'VULKANPLATZ' },
  { plz: '8105', quarter: 'REGENSDORF' },
  { plz: '8125', quarter: 'ZOLLIKERBERG' },
  { plz: '8134', quarter: 'ADLISWIL' },
  { plz: '8152', quarter: 'GLATTBRUGG' },
  { plz: '8153', quarter: 'RÜMLANG' },
  { plz: '8180', quarter: 'BÜLACH' },
  { plz: '8200', quarter: 'SCHAFFHAUSEN' },
  { plz: '8302', quarter: 'KLOTEN' },
  { plz: '8304', quarter: 'WALLISELLEN' },
  { plz: '8305', quarter: 'DIETLIKON' },
  { plz: '8307', quarter: 'EFFRETIKON' },
  { plz: '8400', quarter: 'WINTI', slang: 'WINTERTHUR' },
  { plz: '8404', quarter: 'OBERWINTERTHUR' },
  { plz: '8406', quarter: 'TÖSS' },
  { plz: '8408', quarter: 'WÜLFINGEN' },
  { plz: '8600', quarter: 'DÜBENDORF' },
  { plz: '8604', quarter: 'VOLKETSWIL' },
  { plz: '8610', quarter: 'USTER' },
  { plz: '8620', quarter: 'WETZIKON' },
  { plz: '8700', quarter: 'KÜSNACHT' },
  { plz: '8702', quarter: 'ZOLLIKON' },
  { plz: '8706', quarter: 'MEILEN' },
  { plz: '8712', quarter: 'STÄFA' },
  { plz: '8800', quarter: 'THALWIL' },
  { plz: '8802', quarter: 'KILCHBERG' },
  { plz: '8803', quarter: 'RÜSCHLIKON' },
  { plz: '8810', quarter: 'HORGEN' },
  { plz: '8820', quarter: 'WÄDENSWIL' },
  { plz: '8902', quarter: 'URDORF' },
  { plz: '8952', quarter: 'SCHLIEREN' },
  { plz: '8953', quarter: 'DIETIKON', slang: 'LIMMATTAL' },
] as const;

const activeAllocations = new Set<string>();
/** plz -> timestamp (ms) until which a released code stays blocked. */
const cooldownUntil = new Map<string, number>();
let fallbackCounter = 1;

/** A released code stays off the board for 5 minutes so two guests never mix up the same code. */
export const ZUERI_CODE_COOLDOWN_MS = 5 * 60 * 1000;

export function formatZueriCode(entry: ZueriCodeEntry): ZueriCodeAssignment {
  return {
    plz: entry.plz,
    quarter: entry.quarter,
    slang: entry.slang,
    formatted: `${entry.plz} · ${entry.quarter}`,
  };
}

function isFree(plz: string, now: number): boolean {
  if (activeAllocations.has(plz)) return false;
  const until = cooldownUntil.get(plz);
  if (until !== undefined) {
    if (until > now) return false;
    cooldownUntil.delete(plz);
  }
  return true;
}

/**
 * Allocates an available Züri-Code without collisions.
 * - A free `preferredPlz` wins.
 * - Otherwise a random free code is drawn, so guests do not all get 8001.
 * - If every code is active or cooling down, the code whose cooldown ends first is reused.
 * - Only when all codes are active at once does a suffixed overflow code appear.
 */
export function allocateZueriCode(
  preferredPlz?: string,
  now: number = Date.now(),
  random: () => number = Math.random
): ZueriCodeAssignment {
  if (typeof preferredPlz === 'string' && preferredPlz.trim()) {
    const clean = preferredPlz.trim();
    const match = ZUERI_CODE_POOL.find((c) => c.plz === clean);
    if (match && isFree(match.plz, now)) {
      activeAllocations.add(match.plz);
      return formatZueriCode(match);
    }
  }

  const available = ZUERI_CODE_POOL.filter((c) => isFree(c.plz, now));
  if (available.length > 0) {
    const chosen = available[Math.min(available.length - 1, Math.floor(random() * available.length))];
    activeAllocations.add(chosen.plz);
    return formatZueriCode(chosen);
  }

  // Nothing free: reuse the code that has been cooling down the longest.
  const cooling = ZUERI_CODE_POOL.filter((c) => !activeAllocations.has(c.plz)).sort(
    (a, b) => (cooldownUntil.get(a.plz) || 0) - (cooldownUntil.get(b.plz) || 0)
  );
  if (cooling.length > 0) {
    const chosen = cooling[0];
    cooldownUntil.delete(chosen.plz);
    activeAllocations.add(chosen.plz);
    return formatZueriCode(chosen);
  }

  // Pool exhaustion safety fallback (more than 55 simultaneously active orders)
  const base = ZUERI_CODE_POOL[fallbackCounter % ZUERI_CODE_POOL.length];
  const suffixPlz = `${base.plz}-${fallbackCounter}`;
  fallbackCounter += 1;
  activeAllocations.add(suffixPlz);
  return {
    plz: suffixPlz,
    quarter: base.quarter,
    slang: base.slang,
    formatted: `${suffixPlz} · ${base.quarter}`,
  };
}

/**
 * Releases a code. With `cooldownMs` > 0 the code stays blocked for that time.
 */
export function releaseZueriCode(plz: string, cooldownMs = 0, now: number = Date.now()): boolean {
  const wasActive = activeAllocations.delete(plz);
  if (wasActive && cooldownMs > 0) {
    cooldownUntil.set(plz, now + cooldownMs);
  }
  return wasActive;
}

/** Marks a code as active again, e.g. when orders are restored from disk after a restart. */
export function restoreZueriCodeAllocation(plz: string): void {
  activeAllocations.add(plz);
}

export function isZueriCodeAllocated(plz: string): boolean {
  return activeAllocations.has(plz);
}

export function getAllocatedCount(): number {
  return activeAllocations.size;
}

export function resetZueriCodeAllocations(): void {
  activeAllocations.clear();
  cooldownUntil.clear();
  fallbackCounter = 1;
}
