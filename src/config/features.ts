import { SpiceLevel, DishVariantId, DrinkId } from '../lib/types.js';

export interface FeatureFlags {
  /**
   * Feature Toggle: Custom Spice Level Selection
   * Initial default: false -> Only standard spice ("leicht_scharf") is used to maximize wok speed.
   * When toggled to true -> Customers can choose between mild, leicht_scharf, original_thai_spicy, extra_hot.
   */
  enableCustomSpiceLevels: boolean;
  defaultSpiceLevel: SpiceLevel;
  maxPortionsPerOrder: number;
  latencyThresholdMs: number;
  paymentTimeoutMs: number;
}

const currentFeatures: FeatureFlags = {
  enableCustomSpiceLevels: false,
  defaultSpiceLevel: 'leicht_scharf',
  maxPortionsPerOrder: 10,
  latencyThresholdMs: 1000,
  paymentTimeoutMs: 800,
};

export function getFeatureFlags(): FeatureFlags {
  return { ...currentFeatures };
}

export function setCustomSpiceLevelsEnabled(enabled: boolean): FeatureFlags {
  currentFeatures.enableCustomSpiceLevels = Boolean(enabled);
  return getFeatureFlags();
}

export function resetFeatureFlags(): FeatureFlags {
  currentFeatures.enableCustomSpiceLevels = false;
  currentFeatures.defaultSpiceLevel = 'leicht_scharf';
  currentFeatures.maxPortionsPerOrder = 10;
  currentFeatures.latencyThresholdMs = 1000;
  currentFeatures.paymentTimeoutMs = 800;
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
    priceChf: 14.0,
    isVegan: false,
    badge: 'BESTSELLER · CHF 14',
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

export const SPICE_LABELS: Record<SpiceLevel, { name: string; badge: string; description: string }> = {
  mild: {
    name: 'Mild (Ohne frische Chilis)',
    badge: '🌱 MILD',
    description: 'Volles Basilikum- & Knoblauch-Aroma, fast keine Schärfe.',
  },
  leicht_scharf: {
    name: 'Standardschärfe (Leicht scharf)',
    badge: '🌶️ LEICHT SCHARF (STANDARD)',
    description: 'Unsere perfekt ausbalancierte Holy Basil Haus-Schärfe mit angenehmem Kick.',
  },
  original_thai_spicy: {
    name: 'Original Thai Spicy',
    badge: '🔥🔥 THAI SPICY',
    description: 'Mit frischen roten Bird’s Eye Chilis im Mörser gestampft.',
  },
  extra_hot: {
    name: 'Bangkok Extra Hot',
    badge: '🔥🔥🔥 EXTRA HOT',
    description: 'Kompromisslose Nachtmarkt-Schärfe für echte Chili-Heads.',
  },
};
