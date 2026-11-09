import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  Order,
  CreateOrderInput,
  OrderPortionItem,
  OrderDrinkItem,
  OrderStatus,
  SpiceLevel,
  NewsletterSubscriber,
  B2BInquiry,
  TruckLocationStop,
  WokDemandSummary,
  PublicOrderView,
  BoardEntry,
} from './types.js';
import {
  getFeatureFlags,
  getAvailablePaymentMethods,
  setCustomSpiceLevelsEnabled,
  isSpiceLevel,
  MENU_DISHES,
  MENU_DRINKS,
  KAI_DAO_PRICE_CHF,
} from '../config/features.js';
import {
  allocateZueriCode,
  releaseZueriCode,
  resetZueriCodeAllocations,
  restoreZueriCodeAllocation,
  ZUERI_CODE_COOLDOWN_MS,
} from './zueriCodes.js';
import { processOrderPayment, clearPaymentIdempotencyCache } from './paymentService.js';
import { getWokDemandSummary } from './wokDemand.js';
import { generateCorrelationId } from './response.js';

/** Unpaid orders (cash not yet handed over) are cancelled after this time so their code is freed. */
export const PENDING_ORDER_TTL_MS = 20 * 60 * 1000;
const MAX_NOTE_LENGTH = 200;
const MAX_DRINKS_PER_LINE = 20;

const ACTIVE_STATUSES: readonly OrderStatus[] = [
  'pending_cash',
  'payment_error_fallback',
  'received',
  'in_wok',
  'plating',
  'ready',
];

/**
 * The only allowed moves through the truck pipeline.
 * pending_cash / payment_error_fallback -> received happens via the cashier confirmation.
 */
const STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_cash: ['received', 'cancelled'],
  payment_error_fallback: ['received', 'cancelled'],
  received: ['in_wok', 'plating', 'cancelled'],
  in_wok: ['plating', 'cancelled'],
  plating: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function dataDir(): string {
  return process.env.HB_DATA_DIR
    ? path.resolve(process.env.HB_DATA_DIR)
    : path.resolve(process.cwd(), 'data');
}

type StoreFile = 'orders' | 'subscribers' | 'b2b' | 'settings';

function filePath(name: StoreFile): string {
  return path.join(dataDir(), `${name}.json`);
}

let ordersStore: Order[] = [];
let subscribersStore: NewsletterSubscriber[] = [];
let b2bInquiriesStore: B2BInquiry[] = [];
const inFlightByIdempotencyKey = new Map<string, Promise<Order>>();

const defaultTruckLocations: TruckLocationStop[] = [
  {
    id: 'loc_1',
    dayLabel: 'DIENSTAG',
    dateStr: 'Dienstag, 11:30 – 14:30',
    plz: '8005',
    quarter: 'ZÜRI WEST',
    spotName: 'Prime Tower / Hardbrücke Vorplatz',
    address: 'Hardstrasse 201, 8005 Zürich',
    hours: '11:30 – 14:30 Uhr',
    status: 'live_now',
    vibeNote: 'Mittags-Service · Heisser Wok & frischer Thai Iced Tea',
  },
  {
    id: 'loc_2',
    dayLabel: 'DONNERSTAG',
    dateStr: 'Donnerstag, 17:30 – 22:30',
    plz: '8004',
    quarter: 'LANGSTRASSE',
    spotName: 'Kanzleiareal / Helvetiaplatz Pop-up',
    address: 'Kanzleistrasse 56, 8004 Zürich',
    hours: '17:30 – 22:30 Uhr',
    status: 'upcoming',
    vibeNote: 'Afterwork & Nightmarket Session mit Boom-Bap Beats',
  },
  {
    id: 'loc_3',
    dayLabel: 'FREITAG',
    dateStr: 'Freitag, 11:30 – 14:30',
    plz: '8050',
    quarter: 'OERLIKON',
    spotName: 'MFO-Park / Bahnhof Oerlikon Nord',
    address: 'Sophie-Taeuber-Strasse 4, 8050 Zürich',
    hours: '11:30 – 14:30 Uhr',
    status: 'upcoming',
    vibeNote: 'Friday Lunch Drop im Chreis 11',
  },
  {
    id: 'loc_4',
    dayLabel: 'SAMSTAG',
    dateStr: 'Samstag, 12:00 – 21:00',
    plz: '8400',
    quarter: 'WINTI',
    spotName: 'Lagerplatz / Sulzerareal Streetfood Corner',
    address: 'Lagerplatz 18, 8400 Winterthur',
    hours: '12:00 – 21:00 Uhr',
    status: 'upcoming',
    vibeNote: 'Weekend Special in Winterthur',
  },
  {
    id: 'loc_5',
    dayLabel: 'SONNTAG',
    dateStr: 'Sonntag, 12:00 – 18:00',
    plz: '8001',
    quarter: 'NIEDERDORF',
    spotName: 'Hirschenplatz / Züri Altstadt Pop-up',
    address: 'Hirschenplatz, 8001 Zürich',
    hours: '12:00 – 18:00 Uhr',
    status: 'upcoming',
    vibeNote: 'Sunday Hangover Cure Krapao + Kai Dao',
  },
];


let liveLocationId: string | null = 'loc_1';

function writeJsonAtomic(name: StoreFile, data: unknown): void {
  try {
    const dir = dataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const target = filePath(name);
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, target);
  } catch (err) {
    // Keep serving from memory, but make the problem visible to the crew.
    console.error(`[holy-basil] Konnte ${name}.json nicht speichern:`, err);
  }
}

function readJson<T>(name: StoreFile, fallback: T): T {
  try {
    const target = filePath(name);
    if (!fs.existsSync(target)) return fallback;
    const raw = fs.readFileSync(target, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[holy-basil] Konnte ${name}.json nicht lesen:`, err);
    return fallback;
  }
}

function persistOrders(): void {
  writeJsonAtomic('orders', ordersStore);
}

function persistSettings(): void {
  writeJsonAtomic('settings', {
    liveLocationId,
    enableCustomSpiceLevels: getFeatureFlags().enableCustomSpiceLevels,
  });
}

/**
 * Loads everything from disk. Call once at server start, before accepting requests.
 * Active orders get their Züri-Code back so a restart mid-service loses nothing.
 */
export function loadStoreFromDisk(): { orders: number; subscribers: number; inquiries: number } {
  const orders = readJson<Order[]>('orders', []);
  const subscribers = readJson<NewsletterSubscriber[]>('subscribers', []);
  const inquiries = readJson<B2BInquiry[]>('b2b', []);
  const settings = readJson<{ liveLocationId?: string | null; enableCustomSpiceLevels?: boolean }>(
    'settings',
    {}
  );

  ordersStore = Array.isArray(orders) ? orders.filter((o) => o && typeof o.id === 'string') : [];
  subscribersStore = Array.isArray(subscribers) ? subscribers : [];
  b2bInquiriesStore = Array.isArray(inquiries) ? inquiries : [];

  resetZueriCodeAllocations();
  for (const order of ordersStore) {
    if (ACTIVE_STATUSES.includes(order.status) && order.zueriCode?.plz) {
      restoreZueriCodeAllocation(order.zueriCode.plz);
    }
  }

  if (settings && typeof settings === 'object') {
    if (settings.liveLocationId === null) {
      liveLocationId = null;
    } else if (
      typeof settings.liveLocationId === 'string' &&
      defaultTruckLocations.some((l) => l.id === settings.liveLocationId)
    ) {
      liveLocationId = settings.liveLocationId;
    }
    if (typeof settings.enableCustomSpiceLevels === 'boolean') {
      setCustomSpiceLevelsEnabled(settings.enableCustomSpiceLevels);
    }
  }

  return {
    orders: ordersStore.length,
    subscribers: subscribersStore.length,
    inquiries: b2bInquiriesStore.length,
  };
}

/** Stores the spice toggle so it survives a restart. */
export function setCustomSpiceLevelsAndPersist(enabled: boolean) {
  const flags = setCustomSpiceLevelsEnabled(enabled);
  persistSettings();
  return flags;
}

function cleanNote(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, MAX_NOTE_LENGTH);
  return trimmed || undefined;
}

export function calculateOrderTotal(
  portions: ReadonlyArray<{ variant: keyof typeof MENU_DISHES; addKaiDao?: boolean }>,
  drinks: ReadonlyArray<{ drinkId: keyof typeof MENU_DRINKS; quantity: number }> = []
): number {
  let total = 0;

  for (const p of portions) {
    const dish = Object.prototype.hasOwnProperty.call(MENU_DISHES, p.variant)
      ? MENU_DISHES[p.variant]
      : undefined;
    if (!dish) {
      throw new Error(`INVALID_DISH_VARIANT: ${String(p.variant)}`);
    }
    total += dish.priceChf;
    if (p.addKaiDao) {
      total += KAI_DAO_PRICE_CHF;
    }
  }

  for (const d of drinks) {
    if (d.quantity <= 0) continue;
    const drink = Object.prototype.hasOwnProperty.call(MENU_DRINKS, d.drinkId)
      ? MENU_DRINKS[d.drinkId]
      : undefined;
    if (!drink) {
      throw new Error(`INVALID_DRINK_ID: ${String(d.drinkId)}`);
    }
    total += drink.priceChf * d.quantity;
  }

  return Math.round(total * 100) / 100;
}

export interface CreateOrderOptions {
  /** Only the crew in demo mode may force a simulated payment failure. */
  allowSimulatedFailure?: boolean;
}

export async function createOrder(
  input: CreateOrderInput,
  options: CreateOrderOptions = {}
): Promise<Order> {
  if (!input || typeof input !== 'object') {
    throw new Error('INVALID_ORDER_PAYLOAD');
  }

  const idempotencyKey =
    typeof input.idempotencyKey === 'string' && input.idempotencyKey.trim()
      ? input.idempotencyKey.trim().slice(0, 120)
      : undefined;

  if (idempotencyKey) {
    const existing = ordersStore.find((o) => o.idempotencyKey === idempotencyKey);
    if (existing) return existing;
    // Two requests with the same key arriving at once share one result.
    const inFlight = inFlightByIdempotencyKey.get(idempotencyKey);
    if (inFlight) return inFlight;
  }

  const work = createOrderInternal({ ...input, idempotencyKey }, options);
  if (idempotencyKey) {
    inFlightByIdempotencyKey.set(idempotencyKey, work);
    try {
      return await work;
    } finally {
      inFlightByIdempotencyKey.delete(idempotencyKey);
    }
  }
  return work;
}

async function createOrderInternal(
  input: CreateOrderInput,
  options: CreateOrderOptions
): Promise<Order> {
  const flags = getFeatureFlags();

  if (!Array.isArray(input.portions) || input.portions.length === 0) {
    throw new Error('MIN_PORTIONS_REQUIRED');
  }

  if (input.portions.length > flags.maxPortionsPerOrder) {
    throw new Error(`MAX_PORTIONS_EXCEEDED: Maximum is ${flags.maxPortionsPerOrder} portions`);
  }

  if (!['twint', 'card', 'cash'].includes(input.paymentMethod)) {
    throw new Error('INVALID_PAYMENT_METHOD');
  }
  if (!getAvailablePaymentMethods().includes(input.paymentMethod)) {
    throw new Error('INVALID_PAYMENT_METHOD: Aktuell ist nur Barzahlung am Truck möglich.');
  }

  const normalizedPortions: OrderPortionItem[] = input.portions.map((p, idx) => {
    if (!p || typeof p !== 'object') {
      throw new Error('INVALID_PORTION');
    }
    if (
      typeof p.variant !== 'string' ||
      !Object.prototype.hasOwnProperty.call(MENU_DISHES, p.variant)
    ) {
      throw new Error(`INVALID_DISH_VARIANT: ${String(p.variant).slice(0, 40)}`);
    }
    if (p.spiceLevel !== undefined && p.spiceLevel !== null && !isSpiceLevel(p.spiceLevel)) {
      throw new Error('INVALID_SPICE_LEVEL');
    }
    // Feature Toggle Enforcement:
    // If custom spice levels are disabled, strictly use defaultSpiceLevel ('leicht_scharf')
    const spiceLevel: SpiceLevel =
      flags.enableCustomSpiceLevels && p.spiceLevel ? p.spiceLevel : flags.defaultSpiceLevel;

    return {
      portionIndex: idx + 1,
      variant: p.variant,
      spiceLevel,
      addKaiDao: p.addKaiDao === true,
    };
  });

  if (input.drinks !== undefined && !Array.isArray(input.drinks)) {
    throw new Error('INVALID_DRINKS');
  }

  const normalizedDrinks: OrderDrinkItem[] = [];
  for (const d of input.drinks || []) {
    if (!d || typeof d !== 'object') {
      throw new Error('INVALID_DRINKS');
    }
    if (
      typeof d.drinkId !== 'string' ||
      !Object.prototype.hasOwnProperty.call(MENU_DRINKS, d.drinkId)
    ) {
      throw new Error(`INVALID_DRINK_ID: ${String(d.drinkId).slice(0, 40)}`);
    }
    const quantity = Number(d.quantity);
    if (!Number.isFinite(quantity)) {
      throw new Error('INVALID_DRINK_QUANTITY');
    }
    if (quantity <= 0) continue;
    normalizedDrinks.push({
      drinkId: d.drinkId,
      quantity: Math.min(MAX_DRINKS_PER_LINE, Math.floor(quantity)),
    });
  }

  const totalChf = calculateOrderTotal(normalizedPortions, normalizedDrinks);

  const paymentResult = await processOrderPayment({
    amountChf: totalChf,
    paymentMethod: input.paymentMethod,
    idempotencyKey: input.idempotencyKey,
    simulateFailure:
      options.allowSimulatedFailure === true &&
      flags.demoPayments &&
      input.simulatePaymentFailure === true,
  });

  // The code is drawn only after validation and payment, so a rejected order never blocks one.
  const zueriCode = allocateZueriCode(
    typeof input.preferredPlz === 'string' ? input.preferredPlz : undefined
  );

  const now = new Date().toISOString();
  const order: Order = {
    // Unguessable id: knowing it is what lets a guest open their own ticket.
    id: `ord_${crypto.randomBytes(12).toString('hex')}`,
    zueriCode,
    portions: normalizedPortions,
    drinks: normalizedDrinks,
    totalPortions: normalizedPortions.length,
    totalChf,
    paymentMethod: input.paymentMethod,
    paymentStatus: paymentResult.paymentStatus,
    status: paymentResult.initialOrderStatus,
    idempotencyKey: input.idempotencyKey,
    correlationId: generateCorrelationId('ord'),
    customerNote: cleanNote(input.customerNote),
    createdAt: now,
    updatedAt: now,
    paidAt: paymentResult.paymentStatus === 'paid' ? now : undefined,
  };

  ordersStore.unshift(order);
  persistOrders();

  return order;
}

export function getOrderById(orderId: string): Order | undefined {
  return ordersStore.find((o) => o.id === orderId);
}

export function getAllOrders(): Order[] {
  return [...ordersStore];
}

/** Orders the crew still has to act on. Finished and cancelled ones are left out. */
export function getActiveOrders(): Order[] {
  return ordersStore.filter((o) => ACTIVE_STATUSES.includes(o.status));
}

export function toPublicOrder(order: Order): PublicOrderView {
  return {
    id: order.id,
    zueriCode: order.zueriCode,
    portions: order.portions,
    drinks: order.drinks,
    totalPortions: order.totalPortions,
    totalChf: order.totalChf,
    paymentMethod: order.paymentMethod,
    status: order.status,
    createdAt: order.createdAt,
  };
}

/** Public pickup board: codes only, oldest first. No ids, prices or contents. */
export function getBoardEntries(): BoardEntry[] {
  const entries: BoardEntry[] = [];
  for (let i = ordersStore.length - 1; i >= 0; i--) {
    const o = ordersStore[i];
    if (o.status === 'received' || o.status === 'in_wok' || o.status === 'plating') {
      entries.push({ plz: o.zueriCode.plz, quarter: o.zueriCode.quarter, phase: 'preparing' });
    } else if (o.status === 'ready') {
      entries.push({ plz: o.zueriCode.plz, quarter: o.zueriCode.quarter, phase: 'ready' });
    }
  }
  return entries;
}

/**
 * Station 1 (Kasse / Cashier): Confirms cash payment or resolves a digital payment fallback manually.
 * Transitions the order from `pending_cash` or `payment_error_fallback` into `received` (active in Wok Demand).
 */
export function confirmOrderPaymentAtCashier(orderId: string, resolutionNote?: string): Order {
  const order = ordersStore.find((o) => o.id === orderId);
  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  if (order.status !== 'pending_cash' && order.status !== 'payment_error_fallback') {
    throw new Error(`INVALID_CASHIER_TRANSITION: Order is already in status ${order.status}`);
  }

  const now = new Date().toISOString();
  order.paymentStatus = 'paid';
  order.status = 'received';
  order.paidAt = now;
  order.updatedAt = now;
  const note = cleanNote(resolutionNote);
  if (note) {
    order.manualResolutionNote = note;
  }

  persistOrders();
  return order;
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STATUS_TRANSITIONS, value);
}

/**
 * Moves an order one step along the truck pipeline. Only the moves in STATUS_TRANSITIONS are allowed:
 * - received -> in_wok | plating
 * - in_wok -> plating
 * - plating -> ready (QC & Drinks finished -> Calls out customer!)
 * - ready -> completed (Handed over -> Züri-Code goes into cooldown)
 * - any active status -> cancelled
 */
export function advanceOrderStatus(
  orderId: string,
  targetStatus: OrderStatus,
  note?: string
): Order {
  const order = ordersStore.find((o) => o.id === orderId);
  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  if (!isOrderStatus(targetStatus)) {
    throw new Error('INVALID_TARGET_STATUS');
  }

  if (!STATUS_TRANSITIONS[order.status].includes(targetStatus)) {
    throw new Error(`INVALID_STATUS_TRANSITION: ${order.status} -> ${targetStatus}`);
  }

  if (targetStatus === 'received') {
    return confirmOrderPaymentAtCashier(orderId, note);
  }

  if (order.paymentStatus !== 'paid' && targetStatus !== 'cancelled') {
    throw new Error('UNPAID_ORDER_CANNOT_ADVANCE_IN_KITCHEN');
  }

  const now = new Date().toISOString();
  order.status = targetStatus;
  order.updatedAt = now;

  if (targetStatus === 'plating') {
    order.platedAt = now;
  } else if (targetStatus === 'ready') {
    order.readyAt = now;
  } else if (targetStatus === 'completed') {
    order.completedAt = now;
    releaseZueriCode(order.zueriCode.plz, ZUERI_CODE_COOLDOWN_MS);
  } else if (targetStatus === 'cancelled') {
    order.cancelledAt = now;
    releaseZueriCode(order.zueriCode.plz, ZUERI_CODE_COOLDOWN_MS);
  }

  const cleanedNote = cleanNote(note);
  if (cleanedNote) {
    order.manualResolutionNote = cleanedNote;
  }

  persistOrders();
  return order;
}

/**
 * Cancels unpaid orders nobody paid for within PENDING_ORDER_TTL_MS, so abandoned
 * cash orders do not block Züri-Codes for the rest of the day.
 */
export function expireStalePendingOrders(
  now: number = Date.now(),
  maxAgeMs: number = PENDING_ORDER_TTL_MS
): number {
  let expired = 0;
  for (const order of ordersStore) {
    if (order.status !== 'pending_cash' && order.status !== 'payment_error_fallback') continue;
    const created = Date.parse(order.createdAt);
    if (Number.isNaN(created) || now - created < maxAgeMs) continue;
    const iso = new Date(now).toISOString();
    order.status = 'cancelled';
    order.updatedAt = iso;
    order.cancelledAt = iso;
    order.manualResolutionNote = 'Automatisch storniert: nicht bezahlt';
    releaseZueriCode(order.zueriCode.plz, ZUERI_CODE_COOLDOWN_MS, now);
    expired += 1;
  }
  if (expired > 0) persistOrders();
  return expired;
}

export function getWokDemand(): WokDemandSummary {
  return getWokDemandSummary(ordersStore);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function subscribeNewsletter(input: {
  email: string;
  preferredPlz?: string;
  preferredQuarter?: string;
}): NewsletterSubscriber {
  const cleanEmail = cleanText(input?.email, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(cleanEmail)) {
    throw new Error('INVALID_EMAIL');
  }
  const preferredPlz = cleanText(input.preferredPlz, 10);
  const preferredQuarter = cleanText(input.preferredQuarter, 40);

  const existing = subscribersStore.find((s) => s.email === cleanEmail);
  if (existing) {
    if (preferredPlz) existing.preferredPlz = preferredPlz;
    if (preferredQuarter) existing.preferredQuarter = preferredQuarter;
    writeJsonAtomic('subscribers', subscribersStore);
    return existing;
  }

  const subscriber: NewsletterSubscriber = {
    id: `sub_${crypto.randomBytes(8).toString('hex')}`,
    email: cleanEmail,
    preferredPlz: preferredPlz || '8004',
    preferredQuarter: preferredQuarter || 'LANGSTRASSE',
    createdAt: new Date().toISOString(),
  };

  subscribersStore.unshift(subscriber);
  writeJsonAtomic('subscribers', subscribersStore);
  return subscriber;
}

export function getNewsletterSubscribers(): NewsletterSubscriber[] {
  return [...subscribersStore];
}

const B2B_EVENT_TYPES = ['catering', 'popup', 'cooking_class'] as const;

export function createB2BInquiry(input: {
  companyName: string;
  contactName?: string;
  email: string;
  eventType?: 'catering' | 'popup' | 'cooking_class';
  guestCount?: number;
  preferredDate?: string;
  message?: string;
}): B2BInquiry {
  const companyName = cleanText(input?.companyName, 120);
  const email = cleanText(input?.email, 254).toLowerCase();
  if (!companyName || !EMAIL_PATTERN.test(email)) {
    throw new Error('INVALID_B2B_INQUIRY');
  }

  const eventType = B2B_EVENT_TYPES.includes(input.eventType as (typeof B2B_EVENT_TYPES)[number])
    ? (input.eventType as (typeof B2B_EVENT_TYPES)[number])
    : 'catering';

  const inquiry: B2BInquiry = {
    id: `b2b_${crypto.randomBytes(8).toString('hex')}`,
    companyName,
    contactName: cleanText(input.contactName, 120) || companyName,
    email,
    eventType,
    guestCount: Math.min(5000, Math.max(10, Math.floor(Number(input.guestCount)) || 30)),
    preferredDate: cleanText(input.preferredDate, 60) || 'Nach Vereinbarung',
    message: cleanText(input.message, 1000) || undefined,
    createdAt: new Date().toISOString(),
  };

  b2bInquiriesStore.unshift(inquiry);
  writeJsonAtomic('b2b', b2bInquiriesStore);
  return inquiry;
}

export function getB2BInquiries(): B2BInquiry[] {
  return [...b2bInquiriesStore];
}

/** Tour stops with the stop the crew marked as live. `null` live id means the truck is closed. */
export function getTruckLocations(): TruckLocationStop[] {
  return defaultTruckLocations.map((l) => ({
    ...l,
    status: l.id === liveLocationId ? 'live_now' : 'upcoming',
  }));
}

export function getLiveLocationId(): string | null {
  return liveLocationId;
}

/** Marks one stop as live. Pass `null` when the truck is closed. */
export function setLiveTruckLocation(locationId: string | null): TruckLocationStop[] {
  if (locationId !== null && !defaultTruckLocations.some((l) => l.id === locationId)) {
    throw new Error('LOCATION_NOT_FOUND');
  }
  liveLocationId = locationId;
  persistSettings();
  return getTruckLocations();
}

export function resetOrderStore(): void {
  ordersStore = [];
  subscribersStore = [];
  b2bInquiriesStore = [];
  liveLocationId = 'loc_1';
  inFlightByIdempotencyKey.clear();
  resetZueriCodeAllocations();
  clearPaymentIdempotencyCache();
}
