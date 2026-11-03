import fs from 'node:fs';
import path from 'node:path';
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
} from './types.js';
import {
  getFeatureFlags,
  MENU_DISHES,
  MENU_DRINKS,
  KAI_DAO_PRICE_CHF,
} from '../config/features.js';
import { allocateZueriCode, releaseZueriCode, resetZueriCodeAllocations } from './zueriCodes.js';
import { processOrderPayment, clearPaymentIdempotencyCache } from './paymentService.js';
import { getWokDemandSummary } from './wokDemand.js';
import { generateCorrelationId } from './response.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');

let ordersStore: Order[] = [];
let subscribersStore: NewsletterSubscriber[] = [];
let b2bInquiriesStore: B2BInquiry[] = [];

const defaultTruckLocations: TruckLocationStop[] = [
  {
    id: 'loc_1',
    dayLabel: 'HEUTE · LIVE',
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

let truckLocationsStore: TruckLocationStop[] = [...defaultTruckLocations];

function persistToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(ordersStore, null, 2), 'utf8');
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribersStore, null, 2), 'utf8');
  } catch {
    // Non-blocking persistence in case of read-only test environment
  }
}

export function calculateOrderTotal(
  portions: ReadonlyArray<{ variant: keyof typeof MENU_DISHES; addKaiDao?: boolean }>,
  drinks: ReadonlyArray<{ drinkId: keyof typeof MENU_DRINKS; quantity: number }> = []
): number {
  let total = 0;

  for (const p of portions) {
    const dish = MENU_DISHES[p.variant];
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
    const drink = MENU_DRINKS[d.drinkId];
    if (!drink) {
      throw new Error(`INVALID_DRINK_ID: ${String(d.drinkId)}`);
    }
    total += drink.priceChf * d.quantity;
  }

  return Math.round(total * 100) / 100;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const flags = getFeatureFlags();

  // Check idempotency key on existing orders first
  if (input.idempotencyKey) {
    const existing = ordersStore.find((o) => o.idempotencyKey === input.idempotencyKey);
    if (existing) {
      return existing;
    }
  }

  if (!Array.isArray(input.portions) || input.portions.length === 0) {
    throw new Error('MIN_PORTIONS_REQUIRED');
  }

  if (input.portions.length > flags.maxPortionsPerOrder) {
    throw new Error(`MAX_PORTIONS_EXCEEDED: Maximum is ${flags.maxPortionsPerOrder} portions`);
  }

  if (!['twint', 'card', 'cash'].includes(input.paymentMethod)) {
    throw new Error('INVALID_PAYMENT_METHOD');
  }

  const normalizedPortions: OrderPortionItem[] = input.portions.map((p, idx) => {
    if (!MENU_DISHES[p.variant]) {
      throw new Error(`INVALID_DISH_VARIANT: ${String(p.variant)}`);
    }
    // Feature Toggle Enforcement:
    // If custom spice levels are disabled, strictly use defaultSpiceLevel ('leicht_scharf')
    const spiceLevel: SpiceLevel =
      flags.enableCustomSpiceLevels && p.spiceLevel ? p.spiceLevel : flags.defaultSpiceLevel;

    return {
      portionIndex: idx + 1,
      variant: p.variant,
      spiceLevel,
      addKaiDao: Boolean(p.addKaiDao),
    };
  });

  const normalizedDrinks: OrderDrinkItem[] = (input.drinks || [])
    .filter((d) => d.quantity > 0)
    .map((d) => {
      if (!MENU_DRINKS[d.drinkId]) {
        throw new Error(`INVALID_DRINK_ID: ${String(d.drinkId)}`);
      }
      return {
        drinkId: d.drinkId,
        quantity: Math.min(20, Math.floor(d.quantity)),
      };
    });

  const totalChf = calculateOrderTotal(normalizedPortions, normalizedDrinks);
  const zueriCode = allocateZueriCode(input.preferredPlz);

  const paymentResult = await processOrderPayment({
    amountChf: totalChf,
    paymentMethod: input.paymentMethod,
    idempotencyKey: input.idempotencyKey,
    simulateFailure: input.simulatePaymentFailure,
  });

  const now = new Date().toISOString();
  const orderId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const order: Order = {
    id: orderId,
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
    customerNote: input.customerNote?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    paidAt: paymentResult.paymentStatus === 'paid' ? now : undefined,
  };

  ordersStore.unshift(order);
  persistToDisk();

  return order;
}

export function getOrderById(orderId: string): Order | undefined {
  return ordersStore.find((o) => o.id === orderId);
}

export function getAllOrders(): Order[] {
  return [...ordersStore];
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
  if (resolutionNote) {
    order.manualResolutionNote = resolutionNote;
  }

  persistToDisk();
  return order;
}

/**
 * Transitions an order along the Foodtruck workflow pipeline:
 * - received -> in_wok | plating
 * - in_wok -> plating
 * - plating -> ready (QC & Drinks finished -> Calls out customer!)
 * - ready -> completed (Handed over -> Releases Züri-Code)
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

  const now = new Date().toISOString();

  if (targetStatus === 'received' && (order.status === 'pending_cash' || order.status === 'payment_error_fallback')) {
    return confirmOrderPaymentAtCashier(orderId, note);
  }

  if (order.paymentStatus !== 'paid' && targetStatus !== 'cancelled') {
    throw new Error('UNPAID_ORDER_CANNOT_ADVANCE_IN_KITCHEN');
  }

  order.status = targetStatus;
  order.updatedAt = now;

  if (targetStatus === 'plating') {
    order.platedAt = now;
  } else if (targetStatus === 'ready') {
    order.readyAt = now;
  } else if (targetStatus === 'completed' || targetStatus === 'cancelled') {
    order.completedAt = now;
    releaseZueriCode(order.zueriCode.plz);
  }

  if (note) {
    order.manualResolutionNote = note;
  }

  persistToDisk();
  return order;
}

export function getWokDemand(): WokDemandSummary {
  return getWokDemandSummary(ordersStore);
}

export function subscribeNewsletter(input: {
  email: string;
  preferredPlz?: string;
  preferredQuarter?: string;
}): NewsletterSubscriber {
  const cleanEmail = (input.email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    throw new Error('INVALID_EMAIL');
  }

  const existing = subscribersStore.find((s) => s.email === cleanEmail);
  if (existing) {
    if (input.preferredPlz) existing.preferredPlz = input.preferredPlz;
    if (input.preferredQuarter) existing.preferredQuarter = input.preferredQuarter;
    persistToDisk();
    return existing;
  }

  const subscriber: NewsletterSubscriber = {
    id: `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    email: cleanEmail,
    preferredPlz: input.preferredPlz || '8004',
    preferredQuarter: input.preferredQuarter || 'LANGSTRASSE',
    createdAt: new Date().toISOString(),
  };

  subscribersStore.unshift(subscriber);
  persistToDisk();
  return subscriber;
}

export function getNewsletterSubscribers(): NewsletterSubscriber[] {
  return [...subscribersStore];
}

export function createB2BInquiry(input: {
  companyName: string;
  contactName: string;
  email: string;
  eventType?: 'catering' | 'popup' | 'cooking_class';
  guestCount?: number;
  preferredDate?: string;
  message?: string;
}): B2BInquiry {
  if (!input.companyName?.trim() || !input.email?.trim() || !input.email.includes('@')) {
    throw new Error('INVALID_B2B_INQUIRY');
  }

  const inquiry: B2BInquiry = {
    id: `b2b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    companyName: input.companyName.trim(),
    contactName: (input.contactName || input.companyName).trim(),
    email: input.email.trim().toLowerCase(),
    eventType: input.eventType || 'catering',
    guestCount: Math.max(10, Number(input.guestCount) || 30),
    preferredDate: input.preferredDate || 'Nach Vereinbarung',
    message: input.message?.trim(),
    createdAt: new Date().toISOString(),
  };

  b2bInquiriesStore.unshift(inquiry);
  return inquiry;
}

export function getB2BInquiries(): B2BInquiry[] {
  return [...b2bInquiriesStore];
}

export function getTruckLocations(): TruckLocationStop[] {
  return [...truckLocationsStore];
}

export function setLiveTruckLocation(locationId: string): TruckLocationStop[] {
  const found = truckLocationsStore.find((l) => l.id === locationId);
  if (!found) {
    throw new Error('LOCATION_NOT_FOUND');
  }

  truckLocationsStore = truckLocationsStore.map((l) => ({
    ...l,
    status: l.id === locationId ? 'live_now' : 'upcoming',
  }));

  return getTruckLocations();
}

export function resetOrderStore(): void {
  ordersStore = [];
  subscribersStore = [];
  b2bInquiriesStore = [];
  truckLocationsStore = [...defaultTruckLocations];
  resetZueriCodeAllocations();
  clearPaymentIdempotencyCache();
}
