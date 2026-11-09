import { describe, it, expect, beforeEach } from 'vitest';
import {
  getFeatureFlags,
  setCustomSpiceLevelsEnabled,
  resetFeatureFlags,
  MENU_DISHES,
  MENU_DRINKS,
  SPICE_LABELS,
} from '../../src/config/features.js';
import {
  allocateZueriCode,
  releaseZueriCode,
  isZueriCodeAllocated,
  getAllocatedCount,
  resetZueriCodeAllocations,
  ZUERI_CODE_POOL,
} from '../../src/lib/zueriCodes.js';

describe('Feature Flags & Menu Config', () => {
  beforeEach(() => {
    resetFeatureFlags();
  });

  it('starts with custom spice levels disabled and standard spice set to leicht_scharf', () => {
    const flags = getFeatureFlags();
    expect(flags.enableCustomSpiceLevels).toBe(false);
    expect(flags.defaultSpiceLevel).toBe('leicht_scharf');
    expect(flags.maxPortionsPerOrder).toBe(10);
    expect(flags.latencyThresholdMs).toBe(1000);
  });

  it('toggles custom spice levels on and off cleanly', () => {
    const enabled = setCustomSpiceLevelsEnabled(true);
    expect(enabled.enableCustomSpiceLevels).toBe(true);

    const disabled = setCustomSpiceLevelsEnabled(false);
    expect(disabled.enableCustomSpiceLevels).toBe(false);
  });

  it('defines all 3 Pad Krapao variants, drinks, and spice labels', () => {
    expect(MENU_DISHES.vegan.priceChf).toBe(12);
    expect(MENU_DISHES.chicken.priceChf).toBe(15);
    expect(MENU_DISHES.pork_mix.priceChf).toBe(15);
    expect(MENU_DRINKS.thai_iced_tea.priceChf).toBe(4.5);
    expect(SPICE_LABELS.leicht_scharf.name).toContain('Standardschärfe');
  });
});

describe('Züri-Code Pool & Collision Protection', () => {
  beforeEach(() => {
    resetZueriCodeAllocations();
  });

  it('allocates unique Züri-Codes without collision', () => {
    const c1 = allocateZueriCode();
    const c2 = allocateZueriCode();
    expect(c1.plz).not.toBe(c2.plz);
    expect(isZueriCodeAllocated(c1.plz)).toBe(true);
    expect(getAllocatedCount()).toBe(2);
  });

  it('prioritizes a customer preferred PLZ when available and falls back when already taken', () => {
    const first = allocateZueriCode('8004');
    expect(first.plz).toBe('8004');
    expect(first.quarter).toBe('LANGSTRASSE');

    // Second request for 8004 while still active must get a different PLZ
    const second = allocateZueriCode('8004');
    expect(second.plz).not.toBe('8004');

    // Release 8004 and request again
    expect(releaseZueriCode('8004')).toBe(true);
    const third = allocateZueriCode('8004');
    expect(third.plz).toBe('8004');
  });

  it('draws a random free code instead of always the first one', () => {
    const last = allocateZueriCode(undefined, Date.now(), () => 0.999);
    expect(last.plz).toBe(ZUERI_CODE_POOL[ZUERI_CODE_POOL.length - 1].plz);
    const first = allocateZueriCode(undefined, Date.now(), () => 0);
    expect(first.plz).toBe(ZUERI_CODE_POOL[0].plz);
  });

  it('keeps a released code blocked during its cooldown', () => {
    const t0 = 1_000_000;
    allocateZueriCode('8004', t0);
    releaseZueriCode('8004', 5 * 60 * 1000, t0);

    // Still cooling down: the preferred code is not handed out again
    const during = allocateZueriCode('8004', t0 + 60_000);
    expect(during.plz).not.toBe('8004');

    const after = allocateZueriCode('8004', t0 + 5 * 60 * 1000 + 1);
    expect(after.plz).toBe('8004');
  });

  it('reuses the longest-cooling code before inventing overflow codes', () => {
    const t0 = 2_000_000;
    for (let i = 0; i < ZUERI_CODE_POOL.length; i++) allocateZueriCode(undefined, t0);
    releaseZueriCode('8004', 5 * 60 * 1000, t0);
    releaseZueriCode('8005', 5 * 60 * 1000, t0 + 1000);

    const next = allocateZueriCode(undefined, t0 + 2000);
    expect(next.plz).toBe('8004');
  });

  it('handles full pool exhaustion gracefully with suffixed codes', () => {
    for (let i = 0; i < ZUERI_CODE_POOL.length; i++) {
      allocateZueriCode();
    }
    expect(getAllocatedCount()).toBe(ZUERI_CODE_POOL.length);

    const overflowCode = allocateZueriCode();
    expect(overflowCode.plz).toContain('-1');
    expect(overflowCode.formatted).toContain(overflowCode.quarter);
  });
});
