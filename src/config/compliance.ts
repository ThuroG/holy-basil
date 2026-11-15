import { DishVariantId, DrinkId } from '../lib/types.js';

/**
 * Food-law declarations (LGV / LIV, Kantonales Labor Zürich).
 * See README_APP_AND_TECH.md, chapter 9.
 *
 * Every compliance text and every origin / allergen fact lives in `complianceConfig`.
 * The views render only what `buildCheckoutDeclaration()` and `buildMenuDeclaration()` return.
 */

export const ALLERGEN_IDS = [
  'gluten',
  'krebstiere',
  'eier',
  'fisch',
  'erdnuesse',
  'soja',
  'milch',
  'schalenfruechte',
  'sellerie',
  'senf',
  'sesam',
  'sulfite',
  'lupinen',
  'weichtiere',
] as const;
export type AllergenId = (typeof ALLERGEN_IDS)[number];

export type AllergenStatus = 'contains' | 'may_contain';
export type MeatSpecies = 'poulet' | 'schwein' | 'rind';
export type CountryCode = string;
export type EggHusbandry = 'freiland' | 'boden' | 'kaefig' | 'unknown';

export type ComponentId =
  | 'krapao_sauce'
  | 'jasmine_rice'
  | 'vegan_mince'
  | 'chicken_meat'
  | 'pork_beef_meat'
  | 'kai_dao_egg'
  | 'thai_iced_tea_oat'
  | 'coconut_water'
  | 'zueri_mate';

export type ComplianceItemId = DishVariantId | DrinkId | 'kai_dao';

export interface MeatOrigin {
  country: CountryCode;
  /** True when the meat comes from production with hormones or growth promoters. */
  growthPromoters?: boolean;
}

export interface StopOriginOverride {
  origin: Partial<Record<MeatSpecies, MeatOrigin>>;
  /** ISO date (YYYY-MM-DD), inclusive. */
  validFrom?: string;
  /** ISO date (YYYY-MM-DD), inclusive. */
  validUntil?: string;
}

export interface ComplianceConfig {
  version: string;
  reviewedAt: string;
  reviewedBy: string;
  allergenLabels: Record<AllergenId, string>;
  speciesLabels: Record<MeatSpecies, string>;
  countryLabels: Record<CountryCode, string>;
  components: Record<
    ComponentId,
    {
      label: string;
      ingredients: string;
      allergens: Partial<Record<AllergenId, AllergenStatus>>;
      /** False until the supplier specification confirms the allergens. */
      verified: boolean;
      note?: string;
    }
  >;
  items: Record<
    ComplianceItemId,
    {
      label: string;
      components: ComponentId[];
      meat: MeatSpecies[];
      isVegan: boolean;
      /** Prepared in the shared wok kitchen: cross-contact allergens apply. */
      kitchen: boolean;
    }
  >;
  kitchenCrossContact: AllergenId[];
  origin: {
    default: Partial<Record<MeatSpecies, MeatOrigin>>;
    byStop: Record<string, StopOriginOverride>;
  };
  eggs: { origin: CountryCode; husbandry: EggHusbandry };
  texts: {
    sauceBadge: string;
    originLine: string;
    growthPromoters: string;
    originMissing: string;
    eggLine: string;
    eggLineCage: string;
    eggHusbandry: Record<EggHusbandry, string>;
    containsPrefix: string;
    mayContainPrefix: string;
    allergenShort: string;
    crossContact: string;
    veganNote: string;
    vegetarianNote: string;
    detailsTitle: string;
    recipeBinder: string;
    none: string;
  };
  ui: {
    originAbovePayButton: true;
    blockOnMissingOrigin: true;
    /** Inline block that opens in the checkout itself. No modal. */
    allergenDetails: 'inline';
    recipeBinderOnTruck: true;
  };
}

export const complianceConfig: ComplianceConfig = {
  version: '2026-11-15.1',
  reviewedAt: '2026-11-15',
  reviewedBy: '[NAME VERANTWORTLICHE PERSON]',
  allergenLabels: {
    gluten: 'Gluten (Weizen, Hafer)',
    krebstiere: 'Krebstiere',
    eier: 'Ei',
    fisch: 'Fisch',
    erdnuesse: 'Erdnüsse',
    soja: 'Soja',
    milch: 'Milch',
    schalenfruechte: 'Schalenfrüchte',
    sellerie: 'Sellerie',
    senf: 'Senf',
    sesam: 'Sesam',
    sulfite: 'Sulfite',
    lupinen: 'Lupinen',
    weichtiere: 'Weichtiere',
  },
  speciesLabels: { poulet: 'Poulet', schwein: 'Schwein', rind: 'Rind' },
  countryLabels: {
    CH: 'Schweiz',
    DE: 'Deutschland',
    AT: 'Österreich',
    FR: 'Frankreich',
    IT: 'Italien',
    BR: 'Brasilien',
    AR: 'Argentinien',
    UY: 'Uruguay',
    TH: 'Thailand',
  },
  components: {
    krapao_sauce: {
      label: 'Vegane Krapao-Sauce/Paste',
      ingredients: 'Sojasauce (Soja, Weizen), Pilz-Würzsauce, Knoblauch, Chili, Zucker, Thai Holy Basil',
      allergens: { gluten: 'contains', soja: 'contains', sesam: 'may_contain' },
      verified: false,
      note: 'Bei glutenfreiem Tamari Gluten streichen. Sesam nur, wenn im Rezept.',
    },
    jasmine_rice: {
      label: 'Jasmin-Duftreis',
      ingredients: 'Jasminreis, Wasser',
      allergens: {},
      verified: false,
    },
    vegan_mince: {
      label: 'Soja-/Pilz-Mince',
      ingredients: 'Sojaprotein, Pilze',
      allergens: { soja: 'contains', gluten: 'may_contain' },
      verified: false,
      note: 'Falls Weizenprotein enthalten ist, Gluten auf «contains» ändern.',
    },
    chicken_meat: {
      label: 'Pouletfleisch, gehackt',
      ingredients: 'Pouletfleisch',
      allergens: {},
      verified: false,
    },
    pork_beef_meat: {
      label: 'Schweine- und Rindfleisch, gehackt',
      ingredients: 'Schweinefleisch, Rindfleisch',
      allergens: {},
      verified: false,
    },
    kai_dao_egg: {
      label: 'Kai Dao (Spiegelei)',
      ingredients: 'Ei, Pflanzenöl',
      allergens: { eier: 'contains' },
      verified: false,
    },
    thai_iced_tea_oat: {
      label: 'Thai Iced Tea mit Hafer-Kokos-Creme',
      ingredients: 'Schwarztee, Zucker, Hafer-Kokos-Creme',
      allergens: { gluten: 'contains' },
      verified: false,
      note: 'Variante mit Kondensmilch: Milch statt Gluten, dann nicht vegan.',
    },
    coconut_water: {
      label: 'Kokoswasser',
      ingredients: 'Kokoswasser',
      allergens: {},
      verified: false,
    },
    zueri_mate: {
      label: 'Züri Mate / Limo',
      ingredients: 'Gemäss Etikett',
      allergens: {},
      verified: false,
      note: 'Spezifikation prüfen.',
    },
  },
  items: {
    vegan: {
      label: 'Holy Vegan',
      components: ['krapao_sauce', 'jasmine_rice', 'vegan_mince'],
      meat: [],
      isVegan: true,
      kitchen: true,
    },
    chicken: {
      label: 'Holy Chicken',
      components: ['krapao_sauce', 'jasmine_rice', 'chicken_meat'],
      meat: ['poulet'],
      isVegan: false,
      kitchen: true,
    },
    pork_mix: {
      label: 'Holy Pork / Mix',
      components: ['krapao_sauce', 'jasmine_rice', 'pork_beef_meat'],
      meat: ['schwein', 'rind'],
      isVegan: false,
      kitchen: true,
    },
    kai_dao: {
      label: 'Kai Dao',
      components: ['kai_dao_egg'],
      meat: [],
      isVegan: false,
      kitchen: true,
    },
    thai_iced_tea: {
      label: 'Thai Iced Tea',
      components: ['thai_iced_tea_oat'],
      meat: [],
      isVegan: true,
      kitchen: false,
    },
    coconut_water: {
      label: 'Kokoswasser',
      components: ['coconut_water'],
      meat: [],
      isVegan: true,
      kitchen: false,
    },
    zueri_mate: {
      label: 'Züri Mate',
      components: ['zueri_mate'],
      meat: [],
      isVegan: true,
      kitchen: false,
    },
  },
  kitchenCrossContact: ['eier', 'soja', 'gluten', 'sesam'],
  origin: {
    default: {
      poulet: { country: 'CH' },
      schwein: { country: 'CH' },
      rind: { country: 'CH' },
    },
    byStop: {},
  },
  eggs: { origin: 'CH', husbandry: 'freiland' },
  texts: {
    sauceBadge: '100 % vegane Saucen- & Pastenbasis',
    originLine: 'Fleischherkunft: {species}: {country}',
    growthPromoters: '(mit Hormonen / Leistungsförderern erzeugt)',
    originMissing: 'Herkunft für diesen Standort noch nicht erfasst – bitte Crew fragen.',
    eggLine: 'Kai Dao: Eier aus {husbandry}, Herkunft: {country}',
    eggLineCage: 'Kai Dao: Eier aus Käfighaltung, Herkunft: {country}',
    eggHusbandry: {
      freiland: 'Freilandhaltung',
      boden: 'Bodenhaltung',
      kaefig: 'Käfighaltung',
      unknown: 'Käfighaltung',
    },
    containsPrefix: 'Enthält',
    mayContainPrefix: 'Kann Spuren enthalten',
    allergenShort:
      'Allergene: Unsere Saucen und Gerichte können Soja, Gluten (Weizen), Ei und Sesam enthalten. Details unter «Allergene & Zutaten» und im Rezepturordner am Truck.',
    crossContact:
      'Hinweis: Alle Gerichte werden im selben Wok-Betrieb zubereitet. Trotz sorgfältiger Trennung können Spuren von Ei, Soja, Gluten oder Sesam nicht vollständig ausgeschlossen werden.',
    veganNote:
      'Holy Vegan wird mit eigenem Wok und Besteck und rein pflanzlichen Saucen zubereitet. Kreuzkontakt mit tierischen Produkten in der Küche kann nicht vollständig ausgeschlossen werden.',
    vegetarianNote: 'Holy Vegan mit Kai Dao ist vegetarisch, nicht vegan.',
    detailsTitle: 'Allergene & Zutaten',
    recipeBinder: 'Der Rezepturordner am Truck enthält alle Spezifikationen. Unsere Crew gibt gerne Auskunft.',
    none: 'keine der 14 Hauptallergene',
  },
  ui: {
    originAbovePayButton: true,
    blockOnMissingOrigin: true,
    allergenDetails: 'inline',
    recipeBinderOnTruck: true,
  },
};

function isoDate(now: Date | number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Origin of one species at one tour stop on one date.
 * Order: stop override (inside its time window) -> default -> null (cannot be declared).
 */
export function resolveOrigin(
  species: MeatSpecies,
  stopId: string | null | undefined,
  now: Date | number = Date.now(),
  config: ComplianceConfig = complianceConfig
): MeatOrigin | null {
  const today = isoDate(now);
  const override = stopId ? config.origin.byStop[stopId] : undefined;
  if (override) {
    const inWindow =
      (!override.validFrom || today >= override.validFrom) &&
      (!override.validUntil || today <= override.validUntil);
    const origin = override.origin[species];
    if (inWindow && origin && origin.country) return origin;
  }
  const fallback = config.origin.default[species];
  return fallback && fallback.country ? fallback : null;
}

function originLine(species: MeatSpecies, origin: MeatOrigin, config: ComplianceConfig): string {
  const country = config.countryLabels[origin.country] || origin.country;
  const line = config.texts.originLine
    .replace('{species}', config.speciesLabels[species])
    .replace('{country}', country);
  return origin.growthPromoters ? `${line} ${config.texts.growthPromoters}` : line;
}

export function buildEggLine(config: ComplianceConfig = complianceConfig): string {
  const { origin, husbandry } = config.eggs;
  const country = config.countryLabels[origin] || origin;
  // Imported eggs and unknown husbandry fall back to the cage declaration.
  const cage = husbandry === 'kaefig' || husbandry === 'unknown' || origin !== 'CH';
  if (cage) return config.texts.eggLineCage.replace('{country}', country);
  return config.texts.eggLine
    .replace('{husbandry}', config.texts.eggHusbandry[husbandry])
    .replace('{country}', country);
}

export interface ResolvedAllergens {
  contains: AllergenId[];
  mayContain: AllergenId[];
}

/** Allergens of a set of menu items, derived from their components. */
export function resolveAllergens(
  itemIds: readonly ComplianceItemId[],
  config: ComplianceConfig = complianceConfig
): ResolvedAllergens {
  const contains = new Set<AllergenId>();
  const mayContain = new Set<AllergenId>();
  for (const itemId of itemIds) {
    const item = config.items[itemId];
    if (!item) continue;
    for (const componentId of item.components) {
      const component = config.components[componentId];
      if (!component) continue;
      for (const [allergen, status] of Object.entries(component.allergens) as Array<
        [AllergenId, AllergenStatus]
      >) {
        (status === 'contains' ? contains : mayContain).add(allergen);
      }
    }
    if (item.kitchen) {
      for (const allergen of config.kitchenCrossContact) mayContain.add(allergen);
    }
  }
  return {
    contains: ALLERGEN_IDS.filter((a) => contains.has(a)),
    mayContain: ALLERGEN_IDS.filter((a) => mayContain.has(a) && !contains.has(a)),
  };
}

function allergenLine(prefix: string, ids: readonly AllergenId[], config: ComplianceConfig): string {
  return `${prefix}: ${ids.map((a) => config.allergenLabels[a]).join(', ')}`;
}

export interface ItemDeclaration {
  id: ComplianceItemId;
  label: string;
  /** Origin lines, one per species. Empty for items without meat. */
  originLines: string[];
  /** True when at least one species has no declared origin: the item cannot be ordered. */
  blocked: boolean;
  ingredients: string;
  containsLine: string;
  mayContainLine: string;
  contains: AllergenId[];
  mayContain: AllergenId[];
}

function buildItemDeclaration(
  id: ComplianceItemId,
  stopId: string | null | undefined,
  now: Date | number,
  config: ComplianceConfig
): ItemDeclaration {
  const item = config.items[id];
  const originLines: string[] = [];
  let blocked = false;
  for (const species of item.meat) {
    const origin = resolveOrigin(species, stopId, now, config);
    if (!origin) {
      blocked = true;
      continue;
    }
    originLines.push(originLine(species, origin, config));
  }
  const allergens = resolveAllergens([id], config);
  return {
    id,
    label: item.label,
    originLines,
    blocked,
    ingredients: item.components.map((c) => config.components[c].ingredients).join(', '),
    containsLine: allergens.contains.length
      ? allergenLine(config.texts.containsPrefix, allergens.contains, config)
      : `${config.texts.containsPrefix}: ${config.texts.none}`,
    mayContainLine: allergens.mayContain.length
      ? allergenLine(config.texts.mayContainPrefix, allergens.mayContain, config)
      : '',
    contains: allergens.contains,
    mayContain: allergens.mayContain,
  };
}

export interface MenuDeclaration {
  version: string;
  reviewedAt: string;
  items: Record<ComplianceItemId, ItemDeclaration>;
  eggLine: string;
  allergenLabels: Record<AllergenId, string>;
  texts: Pick<
    ComplianceConfig['texts'],
    | 'sauceBadge'
    | 'originMissing'
    | 'containsPrefix'
    | 'mayContainPrefix'
    | 'allergenShort'
    | 'crossContact'
    | 'veganNote'
    | 'vegetarianNote'
    | 'detailsTitle'
    | 'recipeBinder'
  >;
}

/** Everything the order page needs to show declarations, already rendered as text. */
export function buildMenuDeclaration(
  stopId: string | null | undefined,
  now: Date | number = Date.now(),
  config: ComplianceConfig = complianceConfig
): MenuDeclaration {
  const items = {} as Record<ComplianceItemId, ItemDeclaration>;
  for (const id of Object.keys(config.items) as ComplianceItemId[]) {
    items[id] = buildItemDeclaration(id, stopId, now, config);
  }
  const t = config.texts;
  return {
    version: config.version,
    reviewedAt: config.reviewedAt,
    items,
    eggLine: buildEggLine(config),
    allergenLabels: config.allergenLabels,
    texts: {
      sauceBadge: t.sauceBadge,
      originMissing: t.originMissing,
      containsPrefix: t.containsPrefix,
      mayContainPrefix: t.mayContainPrefix,
      allergenShort: t.allergenShort,
      crossContact: t.crossContact,
      veganNote: t.veganNote,
      vegetarianNote: t.vegetarianNote,
      detailsTitle: t.detailsTitle,
      recipeBinder: t.recipeBinder,
    },
  };
}

export interface CheckoutCart {
  portions: ReadonlyArray<{ variant: DishVariantId; addKaiDao?: boolean }>;
  drinks?: ReadonlyArray<{ drinkId: DrinkId; quantity: number }>;
}

export interface CheckoutDeclaration {
  version: string;
  reviewedAt: string;
  /** True when the cart cannot be sold: an origin is missing. The pay button must be disabled. */
  blocked: boolean;
  blockedReason?: string;
  blockedVariants: DishVariantId[];
  originLines: string[];
  eggLine?: string;
  containsLine: string;
  mayContainLine: string;
  crossContact: string;
  veganNote?: string;
  vegetarianNote?: string;
  /** All lines in display order. Stored on the order as the snapshot. */
  lines: string[];
}

/** The declaration block that stands directly above the pay button, for one cart. */
export function buildCheckoutDeclaration(
  cart: CheckoutCart,
  stopId: string | null | undefined,
  now: Date | number = Date.now(),
  config: ComplianceConfig = complianceConfig
): CheckoutDeclaration {
  const variants = [...new Set(cart.portions.map((p) => p.variant))];
  const hasEgg = cart.portions.some((p) => p.addKaiDao === true);
  const drinkIds = [...new Set((cart.drinks || []).filter((d) => d.quantity > 0).map((d) => d.drinkId))];

  const originLines: string[] = [];
  const blockedVariants: DishVariantId[] = [];
  for (const variant of variants) {
    const decl = buildItemDeclaration(variant, stopId, now, config);
    if (decl.blocked) blockedVariants.push(variant);
    for (const line of decl.originLines) {
      if (!originLines.includes(line)) originLines.push(line);
    }
  }

  const itemIds: ComplianceItemId[] = [...variants, ...(hasEgg ? (['kai_dao'] as const) : []), ...drinkIds];
  const allergens = resolveAllergens(itemIds, config);
  const t = config.texts;
  const containsLine = allergens.contains.length
    ? allergenLine(t.containsPrefix, allergens.contains, config)
    : `${t.containsPrefix}: ${t.none}`;
  const mayContainLine = allergens.mayContain.length
    ? allergenLine(t.mayContainPrefix, allergens.mayContain, config)
    : '';

  const eggLine = hasEgg ? buildEggLine(config) : undefined;
  const hasVegan = variants.includes('vegan');
  const veganWithEgg = cart.portions.some((p) => p.variant === 'vegan' && p.addKaiDao === true);
  const blocked = blockedVariants.length > 0;

  const lines = [
    ...originLines,
    ...(eggLine ? [eggLine] : []),
    containsLine,
    ...(mayContainLine ? [mayContainLine] : []),
    t.crossContact,
    ...(hasVegan ? [t.veganNote] : []),
    ...(veganWithEgg ? [t.vegetarianNote] : []),
  ];

  return {
    version: config.version,
    reviewedAt: config.reviewedAt,
    blocked,
    blockedReason: blocked ? t.originMissing : undefined,
    blockedVariants,
    originLines,
    eggLine,
    containsLine,
    mayContainLine,
    crossContact: t.crossContact,
    veganNote: hasVegan ? t.veganNote : undefined,
    vegetarianNote: veganWithEgg ? t.vegetarianNote : undefined,
    lines,
  };
}

/**
 * Release gate: components whose allergens are not yet confirmed by a supplier specification.
 * The server prints a warning at start while this list is not empty.
 */
export function getUnverifiedComponents(config: ComplianceConfig = complianceConfig): ComponentId[] {
  return (Object.keys(config.components) as ComponentId[]).filter(
    (id) => !config.components[id].verified
  );
}

/** Structural check of the config. Returns a list of problems; empty means consistent. */
export function validateComplianceConfig(config: ComplianceConfig = complianceConfig): string[] {
  const problems: string[] = [];
  for (const [itemId, item] of Object.entries(config.items)) {
    if (item.components.length === 0) problems.push(`Item ${itemId} hat keine Komponenten.`);
    for (const c of item.components) {
      if (!config.components[c]) problems.push(`Item ${itemId}: Komponente ${c} fehlt.`);
    }
  }
  for (const a of ALLERGEN_IDS) {
    if (!config.allergenLabels[a]) problems.push(`Allergen ${a} hat kein Label.`);
  }
  return problems;
}
