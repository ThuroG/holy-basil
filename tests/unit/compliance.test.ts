import { describe, it, expect } from 'vitest';
import {
  ALLERGEN_IDS,
  complianceConfig,
  ComplianceConfig,
  buildCheckoutDeclaration,
  buildMenuDeclaration,
  buildEggLine,
  resolveAllergens,
  resolveOrigin,
  getUnverifiedComponents,
  validateComplianceConfig,
} from '../../src/config/compliance.js';
import { MENU_DISHES, MENU_DRINKS } from '../../src/config/features.js';
import { getReleaseGateWarnings } from '../../src/server.js';

/** A private copy, so a test can change the config without touching the real one. */
function copy(): ComplianceConfig {
  return structuredClone(complianceConfig);
}

const NOV_15 = Date.parse('2026-11-15T12:00:00Z');

describe('Compliance config (LGV / LIV): mandatory tests from README chapter 9.4', () => {
  it('1. every menu item has components, and all components exist', () => {
    expect(validateComplianceConfig()).toEqual([]);
    for (const id of [...Object.keys(MENU_DISHES), ...Object.keys(MENU_DRINKS), 'kai_dao']) {
      const item = complianceConfig.items[id as keyof typeof complianceConfig.items];
      expect(item, id).toBeDefined();
      expect(item.components.length, id).toBeGreaterThan(0);
      for (const c of item.components) expect(complianceConfig.components[c], c).toBeDefined();
    }

    const broken = copy();
    (broken.items.vegan.components as string[]).push('ghost');
    broken.items.chicken.components = [];
    expect(validateComplianceConfig(broken).length).toBe(2);
  });

  it('2. all 14 allergens have a label', () => {
    expect(ALLERGEN_IDS.length).toBe(14);
    for (const a of ALLERGEN_IDS) expect(complianceConfig.allergenLabels[a], a).toBeTruthy();

    const broken = copy();
    broken.allergenLabels.senf = '';
    expect(validateComplianceConfig(broken)).toEqual(['Allergen senf hat kein Label.']);
  });

  it('3. a missing origin for stop and date blocks the cart (fail closed)', () => {
    const cfg = copy();
    delete cfg.origin.default.rind;

    const pork = buildCheckoutDeclaration({ portions: [{ variant: 'pork_mix' }] }, 'loc_1', NOV_15, cfg);
    expect(pork.blocked).toBe(true);
    expect(pork.blockedVariants).toEqual(['pork_mix']);
    expect(pork.blockedReason).toBe(cfg.texts.originMissing);
    // The species that is known is still declared
    expect(pork.originLines).toEqual(['Fleischherkunft: Schwein: Schweiz']);

    // Other variants stay orderable, and the menu marks only the affected card
    const chicken = buildCheckoutDeclaration({ portions: [{ variant: 'chicken' }] }, 'loc_1', NOV_15, cfg);
    expect(chicken.blocked).toBe(false);
    const menu = buildMenuDeclaration('loc_1', NOV_15, cfg);
    expect(menu.items.pork_mix.blocked).toBe(true);
    expect(menu.items.chicken.blocked).toBe(false);
    expect(menu.items.vegan.blocked).toBe(false);
  });

  it('4. a stop override applies only inside its time window, and only at its stop', () => {
    const cfg = copy();
    cfg.origin.byStop.loc_2 = {
      origin: { rind: { country: 'BR', growthPromoters: true } },
      validFrom: '2026-11-10',
      validUntil: '2026-11-20',
    };

    expect(resolveOrigin('rind', 'loc_2', NOV_15, cfg)).toEqual({ country: 'BR', growthPromoters: true });
    expect(resolveOrigin('rind', 'loc_2', Date.parse('2026-11-09T12:00:00Z'), cfg)?.country).toBe('CH');
    expect(resolveOrigin('rind', 'loc_2', Date.parse('2026-11-21T12:00:00Z'), cfg)?.country).toBe('CH');
    expect(resolveOrigin('rind', 'loc_1', NOV_15, cfg)?.country).toBe('CH');
    expect(resolveOrigin('rind', null, NOV_15, cfg)?.country).toBe('CH');
    // Species the override does not mention keep the default
    expect(resolveOrigin('schwein', 'loc_2', NOV_15, cfg)?.country).toBe('CH');

    const decl = buildCheckoutDeclaration({ portions: [{ variant: 'pork_mix' }] }, 'loc_2', NOV_15, cfg);
    expect(decl.originLines).toEqual([
      'Fleischherkunft: Schwein: Schweiz',
      'Fleischherkunft: Rind: Brasilien (mit Hormonen / Leistungsförderern erzeugt)',
    ]);
  });

  it('5. Kai Dao with cage, unknown or imported eggs produces the cage notice', () => {
    expect(buildEggLine()).toBe('Kai Dao: Eier aus Freilandhaltung, Herkunft: Schweiz');

    const boden = copy();
    boden.eggs.husbandry = 'boden';
    expect(buildEggLine(boden)).toBe('Kai Dao: Eier aus Bodenhaltung, Herkunft: Schweiz');

    for (const husbandry of ['kaefig', 'unknown'] as const) {
      const cfg = copy();
      cfg.eggs.husbandry = husbandry;
      expect(buildEggLine(cfg)).toBe('Kai Dao: Eier aus Käfighaltung, Herkunft: Schweiz');
    }

    const imported = copy();
    imported.eggs.origin = 'DE';
    expect(buildEggLine(imported)).toBe('Kai Dao: Eier aus Käfighaltung, Herkunft: Deutschland');

    // The egg line only appears when an egg is in the cart
    const without = buildCheckoutDeclaration({ portions: [{ variant: 'chicken' }] }, 'loc_1');
    const withEgg = buildCheckoutDeclaration({ portions: [{ variant: 'chicken', addKaiDao: true }] }, 'loc_1');
    expect(without.eggLine).toBeUndefined();
    expect(withEgg.eggLine).toBe(buildEggLine());
    expect(withEgg.containsLine).toContain(' Ei,');
    expect(without.mayContainLine).toContain(' Ei,');
  });

  it('6. Holy Vegan plus Kai Dao shows the vegetarian notice', () => {
    const vegan = buildCheckoutDeclaration({ portions: [{ variant: 'vegan' }] }, 'loc_1');
    expect(vegan.originLines).toEqual([]);
    expect(vegan.veganNote).toBe(complianceConfig.texts.veganNote);
    expect(vegan.vegetarianNote).toBeUndefined();

    const veggie = buildCheckoutDeclaration({ portions: [{ variant: 'vegan', addKaiDao: true }] }, 'loc_1');
    expect(veggie.vegetarianNote).toBe(complianceConfig.texts.vegetarianNote);
    expect(veggie.lines).toContain(complianceConfig.texts.vegetarianNote);

    // An egg on another box does not make the vegan box vegetarian
    const mixed = buildCheckoutDeclaration(
      { portions: [{ variant: 'vegan' }, { variant: 'chicken', addKaiDao: true }] },
      'loc_1'
    );
    expect(mixed.vegetarianNote).toBeUndefined();
    expect(mixed.originLines).toEqual(['Fleischherkunft: Poulet: Schweiz']);
  });

  it('7. release gate: unverified components raise a warning at server start', () => {
    expect(getUnverifiedComponents().length).toBeGreaterThan(0);
    expect(getReleaseGateWarnings().some((w) => w.includes('verified: false'))).toBe(true);

    const verified = copy();
    for (const c of Object.values(verified.components)) c.verified = true;
    expect(getUnverifiedComponents(verified)).toEqual([]);
  });
});

describe('Allergens derived from components', () => {
  it('matches the table in README chapter 9.2', () => {
    expect(resolveAllergens(['chicken'])).toEqual({ contains: ['gluten', 'soja'], mayContain: ['eier', 'sesam'] });
    expect(resolveAllergens(['vegan'])).toEqual({ contains: ['gluten', 'soja'], mayContain: ['eier', 'sesam'] });
    expect(resolveAllergens(['chicken', 'kai_dao'])).toEqual({
      contains: ['gluten', 'eier', 'soja'],
      mayContain: ['sesam'],
    });
    // Drinks are not made in the wok kitchen: no cross-contact allergens
    expect(resolveAllergens(['coconut_water'])).toEqual({ contains: [], mayContain: [] });
    expect(resolveAllergens(['thai_iced_tea'])).toEqual({ contains: ['gluten'], mayContain: [] });
  });

  it('changes every affected dish when one component changes', () => {
    const cfg = copy();
    cfg.components.krapao_sauce.allergens = { soja: 'contains' }; // gluten-free tamari
    expect(resolveAllergens(['chicken'], cfg).contains).toEqual(['soja']);
    expect(resolveAllergens(['pork_mix'], cfg).contains).toEqual(['soja']);
    // Gluten stays a possible trace through the shared kitchen
    expect(resolveAllergens(['chicken'], cfg).mayContain).toContain('gluten');
  });

  it('always lists cross-contact and the allergens before the pay button', () => {
    const decl = buildCheckoutDeclaration(
      { portions: [{ variant: 'pork_mix' }], drinks: [{ drinkId: 'thai_iced_tea', quantity: 1 }] },
      'loc_1'
    );
    expect(decl.lines[0]).toBe('Fleischherkunft: Schwein: Schweiz');
    expect(decl.lines[1]).toBe('Fleischherkunft: Rind: Schweiz');
    expect(decl.lines).toContain(complianceConfig.texts.crossContact);
    expect(decl.containsLine).toBe('Enthält: Gluten (Weizen, Hafer), Soja');
    expect(decl.version).toBe(complianceConfig.version);
  });
});
