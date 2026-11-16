import { SpiceLevel, DishVariantId, DrinkId, PaymentMethod, NutritionInfo } from '../lib/types.js';

export interface FeatureFlags {
  /**
   * Feature Toggle: Custom Spice Level Selection
   * Initial default: false -> Only standard spice ("leicht_scharf" / เผ็ดนิดหน่อย) is used to maximize wok speed.
   * When toggled to true -> Customers can choose per portion between 0 (ไม่เผ็ด), 1 (เผ็ดนิดหน่อย), 2 (เผ็ดมาก).
   */
  enableCustomSpiceLevels: boolean;
  /**
   * Feature Toggle: Holy Gains 💪 (Extra Fleisch / Plant-Protein, + CHF 3.50)
   * Initial default: false -> Standard portions only.
   * When toggled to true -> Customers can add extra protein per portion for + CHF 3.50.
   */
  enableHolyGains: boolean;
  defaultSpiceLevel: SpiceLevel;
  maxPortionsPerOrder: number;
  latencyThresholdMs: number;
  paymentTimeoutMs: number;
  /**
   * Demo payments: TWINT / card run against the built-in TEST provider (no real money moves).
   * Off by default -> only cash at the truck is accepted.
   * Enable for demos with the env variable DEMO_PAYMENTS=1.
   */
  demoPayments: boolean;
  /** Portions one wok batch holds. Drives the batch button and the wait estimate. */
  wokBatchSize: number;
  /** Minutes one wok batch takes. */
  wokBatchMinutes: number;
  /** Crew switch: guests cannot place new orders while this is on. */
  ordersPaused: boolean;
}

function demoPaymentsFromEnv(): boolean {
  return process.env.DEMO_PAYMENTS === '1' || process.env.DEMO_PAYMENTS === 'true';
}

const currentFeatures: FeatureFlags = {
  enableCustomSpiceLevels: false,
  enableHolyGains: false,
  defaultSpiceLevel: 'leicht_scharf',
  maxPortionsPerOrder: 10,
  latencyThresholdMs: 1000,
  paymentTimeoutMs: 800,
  demoPayments: demoPaymentsFromEnv(),
  wokBatchSize: 4,
  wokBatchMinutes: 2.5,
  ordersPaused: false,
};

export function getFeatureFlags(): FeatureFlags {
  return { ...currentFeatures };
}

export function setCustomSpiceLevelsEnabled(enabled: boolean): FeatureFlags {
  currentFeatures.enableCustomSpiceLevels = Boolean(enabled);
  return getFeatureFlags();
}

export function setHolyGainsEnabled(enabled: boolean): FeatureFlags {
  currentFeatures.enableHolyGains = Boolean(enabled);
  return getFeatureFlags();
}

export function setDemoPaymentsEnabled(enabled: boolean): FeatureFlags {
  currentFeatures.demoPayments = Boolean(enabled);
  return getFeatureFlags();
}

export function setOrdersPaused(paused: boolean): FeatureFlags {
  currentFeatures.ordersPaused = Boolean(paused);
  return getFeatureFlags();
}

/** Payment methods a guest may currently choose. */
export function getAvailablePaymentMethods(): PaymentMethod[] {
  return currentFeatures.demoPayments ? ['cash', 'twint', 'card'] : ['cash'];
}

export function isSpiceLevel(value: unknown): value is SpiceLevel {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SPICE_LABELS, value);
}

export function resetFeatureFlags(): FeatureFlags {
  currentFeatures.enableCustomSpiceLevels = false;
  currentFeatures.enableHolyGains = false;
  currentFeatures.defaultSpiceLevel = 'leicht_scharf';
  currentFeatures.maxPortionsPerOrder = 10;
  currentFeatures.latencyThresholdMs = 1000;
  currentFeatures.paymentTimeoutMs = 800;
  currentFeatures.demoPayments = demoPaymentsFromEnv();
  currentFeatures.wokBatchSize = 4;
  currentFeatures.wokBatchMinutes = 2.5;
  currentFeatures.ordersPaused = false;
  return getFeatureFlags();
}

export interface DishConfig {
  id: DishVariantId;
  name: string;
  thaiName: string;
  tagline: string;
  description: string;
  priceChf: number;
  isVegan: boolean;
  badge: string;
}

export const MENU_DISHES: Record<DishVariantId, DishConfig> = {
  vegan: {
    id: 'vegan',
    name: 'HOLY VEGAN',
    thaiName: 'ผัดกะเพราเจ',
    tagline: '100% Plant-Based Umami Bomb',
    description:
      'Knusprig im Wok gebratenes Soja- & Pilz-Mince mit frischem Thai Holy Basil, Knoblauch, Chilis, unserer geheimen 100% veganen Krapao-Sauce und warmem Jasmin-Duftreis.',
    priceChf: 12.0,
    isVegan: true,
    badge: '100% VEGAN · CHF 12',
  },
  chicken: {
    id: 'chicken',
    name: 'HOLY CHICKEN',
    thaiName: 'ผัดกะเพราไก่สับ',
    tagline: 'Der Bangkok Nightmarket Klassiker',
    description:
      'Fein gehacktes Schweizer Pouletfleisch bei voller Wok-Hitze gebraten mit frischem Holy Basil, Knoblauch, Chilis, 100% veganer Krapao-Umami-Sauce und Jasmin-Duftreis.',
    priceChf: 15.0,
    isVegan: false,
    badge: 'BESTSELLER · CHF 15',
  },
  pork_mix: {
    id: 'pork_mix',
    name: 'HOLY PORK / MIX',
    thaiName: 'ผัดกะเพราหมูสับ',
    tagline: 'Kräftiger Street-Style Mix',
    description:
      'Deftig gehacktes Schweinefleisch-Rind-Mince aus dem flammenden Wok mit viel Holy Basil, Knoblauch, Chilis, 100% veganer Krapao-Sauce und Jasmin-Duftreis.',
    priceChf: 15.0,
    isVegan: false,
    badge: 'HEAVY HIT · CHF 15',
  },
};

export const KAI_DAO_PRICE_CHF = 2.5;
export const HOLY_GAINS_PRICE_CHF = 3.5;

export const NUTRITION_ESTIMATES: Record<
  DishVariantId | DrinkId | 'kai_dao' | 'holy_gains_meat' | 'holy_gains_vegan',
  NutritionInfo
> = {
  vegan: { caloriesKcal: 540, proteinGrams: 28, carbsGrams: 68, fatGrams: 16 },
  chicken: { caloriesKcal: 620, proteinGrams: 38, carbsGrams: 60, fatGrams: 24 },
  pork_mix: { caloriesKcal: 710, proteinGrams: 36, carbsGrams: 60, fatGrams: 35 },
  kai_dao: { caloriesKcal: 110, proteinGrams: 7, carbsGrams: 1, fatGrams: 9 },
  holy_gains_meat: { caloriesKcal: 210, proteinGrams: 28, carbsGrams: 1, fatGrams: 8 },
  holy_gains_vegan: { caloriesKcal: 180, proteinGrams: 20, carbsGrams: 10, fatGrams: 6 },
  thai_iced_tea: { caloriesKcal: 160, proteinGrams: 2, carbsGrams: 28, fatGrams: 5 },
  coconut_water: { caloriesKcal: 70, proteinGrams: 1, carbsGrams: 16, fatGrams: 0 },
  zueri_mate: { caloriesKcal: 60, proteinGrams: 0, carbsGrams: 14, fatGrams: 0 },
};

/** Sums estimated nutrition (kcal, protein, carbs, fat in grams) for an order. */
export function calculateOrderNutrition(
  portions: ReadonlyArray<{ variant: DishVariantId; addKaiDao?: boolean; holyGains?: boolean }>,
  drinks: ReadonlyArray<{ drinkId: DrinkId; quantity: number }> = []
): NutritionInfo {
  const total: NutritionInfo = { caloriesKcal: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 };
  const add = (info: NutritionInfo | undefined, mult = 1) => {
    if (!info || mult <= 0) return;
    total.caloriesKcal += info.caloriesKcal * mult;
    total.proteinGrams += info.proteinGrams * mult;
    total.carbsGrams += info.carbsGrams * mult;
    total.fatGrams += info.fatGrams * mult;
  };
  for (const p of portions) {
    add(NUTRITION_ESTIMATES[p.variant]);
    if (p.addKaiDao) add(NUTRITION_ESTIMATES.kai_dao);
    if (p.holyGains) {
      add(p.variant === 'vegan' ? NUTRITION_ESTIMATES.holy_gains_vegan : NUTRITION_ESTIMATES.holy_gains_meat);
    }
  }
  for (const d of drinks) {
    if (d.quantity > 0) add(NUTRITION_ESTIMATES[d.drinkId], d.quantity);
  }
  return total;
}

export interface DrinkConfig {
  id: DrinkId;
  name: string;
  description: string;
  priceChf: number;
}

export const MENU_DRINKS: Record<DrinkId, DrinkConfig> = {
  thai_iced_tea: {
    id: 'thai_iced_tea',
    name: 'Hausgemachter Thai Iced Tea (Cha Yen)',
    description: 'Schwarzer Ceylon-Thai-Tee auf Eis mit süsser Hafer-Kokos-Creme (100% vegan) – der perfekte Feuerlöscher.',
    priceChf: 4.5,
  },
  coconut_water: {
    id: 'coconut_water',
    name: 'Junges Thai Kokoswasser (Eiskalt)',
    description: '100% reines Nam Hom Kokoswasser direkt auf Eis gekühlt.',
    priceChf: 4.0,
  },
  zueri_mate: {
    id: 'zueri_mate',
    name: 'Züri Urban Sparkling Mate / Limo',
    description: 'Lokaler Zürcher Koffein-Kick, herb-frisch zu Pad Krapao.',
    priceChf: 4.0,
  },
};

export const SPICE_LABELS: Record<SpiceLevel, { name: string; thai: string; badge: string; chilis: number; description: string }> = {
  mild: {
    name: '0 · ไม่เผ็ด (Nicht scharf)',
    thai: 'ไม่เผ็ด',
    badge: '0 · ไม่เผ็ด (NICHT SCHARF)',
    chilis: 0,
    description: 'Volles Basilikum- & Knoblauch-Aroma, ohne frische Chilis.',
  },
  leicht_scharf: {
    name: '1 🌶️ · เผ็ดนิดหน่อย (Leicht scharf)',
    thai: 'เผ็ดนิดหน่อย',
    badge: '🌶️ เผ็ดนิดหน่อย (STANDARD)',
    chilis: 1,
    description: 'Unsere perfekt ausbalancierte Holy Basil Haus-Schärfe mit angenehmem Kick.',
  },
  original_thai_spicy: {
    name: '2 🌶️🌶️ · เผ็ดมาก (Scharf)',
    thai: 'เผ็ดมาก',
    badge: '🌶️🌶️ เผ็ดมาก (SCHARF)',
    chilis: 2,
    description: 'Mit frischen roten Bird’s Eye Chilis im Mörser gestampft.',
  },
  extra_hot: {
    name: '3 🔥🔥🔥 · เผ็ดมากที่สุด (Extra Hot)',
    thai: 'เผ็ดมากที่สุด',
    badge: '🔥🔥🔥 EXTRA HOT',
    chilis: 3,
    description: 'Kompromisslose Nachtmarkt-Schärfe für echte Chili-Heads.',
  },
};
