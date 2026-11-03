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
let fallbackCounter = 1;

export function formatZueriCode(entry: ZueriCodeEntry): ZueriCodeAssignment {
  return {
    plz: entry.plz,
    quarter: entry.quarter,
    slang: entry.slang,
    formatted: `${entry.plz} · ${entry.quarter}`,
  };
}

/**
 * Allocates an available Züri-Code without collisions.
 * If the customer specifies a `preferredPlz` that is currently free, it is prioritized!
 */
export function allocateZueriCode(preferredPlz?: string): ZueriCodeAssignment {
  if (preferredPlz) {
    const clean = preferredPlz.trim();
    const match = ZUERI_CODE_POOL.find((c) => c.plz === clean);
    if (match && !activeAllocations.has(match.plz)) {
      activeAllocations.add(match.plz);
      return formatZueriCode(match);
    }
  }

  // Find all free entries in the pool
  const available = ZUERI_CODE_POOL.filter((c) => !activeAllocations.has(c.plz));

  if (available.length > 0) {
    // Pick deterministically or randomly among top iconic codes first, then rest
    const chosen = available[0];
    activeAllocations.add(chosen.plz);
    return formatZueriCode(chosen);
  }

  // Pool exhaustion safety fallback (e.g. > 55 simultaneous active orders at festival peak)
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

export function releaseZueriCode(plz: string): boolean {
  return activeAllocations.delete(plz);
}

export function isZueriCodeAllocated(plz: string): boolean {
  return activeAllocations.has(plz);
}

export function getAllocatedCount(): number {
  return activeAllocations.size;
}

export function resetZueriCodeAllocations(): void {
  activeAllocations.clear();
  fallbackCounter = 1;
}
