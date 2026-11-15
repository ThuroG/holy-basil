import crypto from 'node:crypto';
import {
  Order,
  CreateOrderInput,
  OrderPortionItem,
  OrderDrinkItem,
  OrderStatus,
  SpiceLevel,
  B2BInquiry,
  TruckLocationStop,
  WokDemandSummary,
  PublicOrderView,
  BoardEntry,
  DishVariantId,
  RefundReason,
} from './types.js';
import {
  getFeatureFlags,
  getAvailablePaymentMethods,
  setCustomSpiceLevelsEnabled,
  setOrdersPaused,
  isSpiceLevel,
  MENU_DISHES,
  MENU_DRINKS,
  KAI_DAO_PRICE_CHF,
} from '../config/features.js';
import { buildCheckoutDeclaration } from '../config/compliance.js';
import { defaultTruckLocations } from '../config/tourStops.js';
import {
  allocateZueriCode,
  releaseZueriCode,
  reclaimZueriCode,
  resetZueriCodeAllocations,
  restoreZueriCodeAllocation,
  ZUERI_CODE_COOLDOWN_MS,
} from './zueriCodes.js';
import { startCheckout, chfToRappen, PaymentEvent, resetPaymentService } from './paymentService.js';
import { getWokDemandSummary } from './wokDemand.js';
import { generateCorrelationId, recordPaymentAttempt } from './response.js';
import { readJson, writeJsonAtomic } from './storage.js';
import { resetRateLimits } from './rateLimit.js';
import { resetOutbox } from './mailer.js';
import {
  loadNewsletterFromDisk,
  resetNewsletter,
  getNewsletterSubscribers,
} from './newsletter.js';

export { getNewsletterSubscribers };

/** Unpaid orders are cancelled after this time so their code is freed. */
export const PENDING_ORDER_TTL_MS = 20 * 60 * 1000;
/** A crew move can be taken back for this long. */
export const UNDO_WINDOW_MS = 60 * 1000;
/** Finished orders leave the live file after this time. */
export const ARCHIVE_AFTER_MS = 12 * 60 * 60 * 1000;
const MAX_NOTE_LENGTH = 200;
const MAX_DRINKS_PER_LINE = 20;
const MAX_PROCESSED_EVENTS = 2000;

const UNPAID_STATUSES: readonly OrderStatus[] = [
  'pending_cash',
  'pending_payment',
  'payment_error_fallback',
];

const ACTIVE_STATUSES: readonly OrderStatus[] = [
  ...UNPAID_STATUSES,
  'received',
  'in_wok',
  'plating',
  'ready',
];

/**
 * The only allowed forward moves through the truck pipeline.
 * An unpaid order reaches `received` through the cashier or through the payment webhook.
 */
const STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_cash: ['received', 'cancelled'],
  pending_payment: ['received', 'cancelled'],
  payment_error_fallback: ['received', 'cancelled'],
  received: ['in_wok', 'plating', 'cancelled'],
  in_wok: ['plating', 'cancelled'],
  plating: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

let ordersStore: Order[] = [];
let b2bInquiriesStore: B2BInquiry[] = [];
let processedPaymentEvents: string[] = [];
const inFlightByIdempotencyKey = new Map<string, Promise<Order>>();

let liveLocationId: string | null = 'loc_1';

function persistOrders(): void {
  writeJsonAtomic('orders', ordersStore);
}

function persistSettings(): void {
  const flags = getFeatureFlags();
  writeJsonAtomic('settings', {
    liveLocationId,
    enableCustomSpiceLevels: flags.enableCustomSpiceLevels,
    ordersPaused: flags.ordersPaused,
  });
}

/**
 * Loads everything from disk. Call once at server start, before accepting requests.
 * Active orders get their Züri-Code back so a restart mid-service loses nothing.
 */
export function loadStoreFromDisk(): { orders: number; subscribers: number; inquiries: number } {
  const orders = readJson<Order[]>('orders', []);
  const inquiries = readJson<B2BInquiry[]>('b2b', []);
  const events = readJson<string[]>('payment-events', []);
  const settings = readJson<{
    liveLocationId?: string | null;
    enableCustomSpiceLevels?: boolean;
    ordersPaused?: boolean;
  }>('settings', {});

  ordersStore = Array.isArray(orders) ? orders.filter((o) => o && typeof o.id === 'string') : [];
  b2bInquiriesStore = Array.isArray(inquiries) ? inquiries : [];
  processedPaymentEvents = Array.isArray(events) ? events.filter((e) => typeof e === 'string') : [];
  const subscribers = loadNewsletterFromDisk();

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
    if (typeof settings.ordersPaused === 'boolean') {
      setOrdersPaused(settings.ordersPaused);
    }
  }

  return {
    orders: ordersStore.length,
    subscribers,
    inquiries: b2bInquiriesStore.length,
  };
}

/** Stores the spice toggle so it survives a restart. */
export function setCustomSpiceLevelsAndPersist(enabled: boolean) {
  const flags = setCustomSpiceLevelsEnabled(enabled);
  persistSettings();
  return flags;
}

/** Crew switch «Annahme pausieren». Survives a restart. */
export function setOrdersPausedAndPersist(paused: boolean) {
  const flags = setOrdersPaused(paused);
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
  /** The crew may still enter orders while guest ordering is paused. */
  isCrew?: boolean;
  /** Test hook: delay of the test provider, to exercise the checkout timeout. */
  simulatedCheckoutDelayMs?: number;
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

  // Valid payload from here on. Guests are stopped while the crew paused ordering.
  if (flags.ordersPaused && options.isCrew !== true) {
    throw new Error('ORDERS_PAUSED');
  }

  // Fail closed: without a declared meat origin for this stop the cart cannot be sold.
  const stopId = liveLocationId;
  const declaration = buildCheckoutDeclaration(
    { portions: normalizedPortions, drinks: normalizedDrinks },
    stopId
  );
  if (declaration.blocked) {
    throw new Error('ORIGIN_NOT_DECLARED');
  }

  const totalChf = calculateOrderTotal(normalizedPortions, normalizedDrinks);
  // Unguessable id: knowing it is what lets a guest open their own ticket.
  const orderId = `ord_${crypto.randomBytes(12).toString('hex')}`;
  const now = new Date().toISOString();

  let status: OrderStatus = 'pending_cash';
  let payment: Order['payment'];
  let failureNote: string | undefined;

  if (input.paymentMethod !== 'cash') {
    const base = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
    const checkout = await startCheckout({
      orderId,
      amountRappen: chfToRappen(totalChf),
      currency: 'CHF',
      method: input.paymentMethod,
      idempotencyKey: input.idempotencyKey || orderId,
      returnUrl: `${base}/order/${orderId}`,
      simulateFailure:
        options.allowSimulatedFailure === true &&
        flags.demoPayments &&
        input.simulatePaymentFailure === true,
      simulatedDelayMs: options.simulatedCheckoutDelayMs,
    });
    if (checkout.ok) {
      status = 'pending_payment';
      payment = {
        provider: checkout.provider,
        providerRef: checkout.session.providerRef,
        redirectUrl: checkout.session.redirectUrl,
        expiresAt: checkout.session.expiresAt,
      };
    } else {
      // Zero-loss fallback: keep the order and the code, the cashier settles it by hand.
      recordPaymentAttempt('fallback');
      status = 'payment_error_fallback';
      failureNote = `Zahlung nicht gestartet: ${checkout.reason}`;
    }
  }

  // The code is drawn only after validation and checkout, so a rejected order never blocks one.
  const zueriCode = allocateZueriCode(
    typeof input.preferredPlz === 'string' ? input.preferredPlz : undefined
  );

  const order: Order = {
    id: orderId,
    zueriCode,
    portions: normalizedPortions,
    drinks: normalizedDrinks,
    totalPortions: normalizedPortions.length,
    totalChf,
    paymentMethod: input.paymentMethod,
    paymentStatus: status as Order['paymentStatus'],
    status,
    idempotencyKey: input.idempotencyKey,
    correlationId: generateCorrelationId('ord'),
    customerNote: cleanNote(input.customerNote),
    manualResolutionNote: failureNote,
    createdAt: now,
    updatedAt: now,
    stopId,
    declaration: { version: declaration.version, lines: declaration.lines },
    payment,
  };

  ordersStore.unshift(order);
  persistOrders();

  return order;
}

export function getOrderById(orderId: string): Order | undefined {
  return ordersStore.find((o) => o.id === orderId);
}

export function getOrderByPaymentRef(providerRef: string): Order | undefined {
  return ordersStore.find((o) => o.payment?.providerRef === providerRef);
}

export function getAllOrders(): Order[] {
  return [...ordersStore];
}

function hasOpenRefund(order: Order): boolean {
  return order.refundDue !== undefined && order.refundDue.resolvedAt === undefined;
}

/** Orders the crew still has to act on, including finished ones with an open refund. */
export function getActiveOrders(): Order[] {
  return ordersStore.filter((o) => ACTIVE_STATUSES.includes(o.status) || hasOpenRefund(o));
}

/** Orders created on the same calendar day as `now` (server time). */
export function getOrdersTodayCount(now: number = Date.now()): number {
  const today = new Date(now).toDateString();
  return ordersStore.filter((o) => new Date(o.createdAt).toDateString() === today).length;
}

export function toPublicOrder(order: Order): PublicOrderView {
  return {
    id: order.id,
    zueriCode: order.zueriCode,
    portions: order.portions.map((p) => ({
      portionIndex: p.portionIndex,
      variant: p.variant,
      spiceLevel: p.spiceLevel,
      addKaiDao: p.addKaiDao,
    })),
    drinks: order.drinks,
    totalPortions: order.totalPortions,
    totalChf: order.totalChf,
    paymentMethod: order.paymentMethod,
    status: order.status,
    createdAt: order.createdAt,
    declaration: order.declaration,
    paymentUrl: order.status === 'pending_payment' ? order.payment?.redirectUrl : undefined,
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
      entries.push({
        plz: o.zueriCode.plz,
        quarter: o.zueriCode.quarter,
        phase: 'ready',
        readyAt: o.readyAt,
      });
    }
  }
  return entries;
}

/** What guests may know about the queue before they order. */
export function getQueueInfo(): { estimatedWaitMinutes: number; ordersPaused: boolean } {
  return {
    estimatedWaitMinutes: getWokDemand().estimatedWaitMinutes,
    ordersPaused: getFeatureFlags().ordersPaused,
  };
}

function markPaid(order: Order, nowIso: string): void {
  order.paymentStatus = 'paid';
  order.status = 'received';
  order.paidAt = nowIso;
  order.updatedAt = nowIso;
  order.previousStatus = undefined;
}

/**
 * Station 1 (Kasse / Cashier): confirms a payment by hand.
 * Moves an unpaid order (cash, open digital payment or payment fallback) into `received`.
 */
export function confirmOrderPaymentAtCashier(orderId: string, resolutionNote?: string): Order {
  const order = ordersStore.find((o) => o.id === orderId);
  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  if (!UNPAID_STATUSES.includes(order.status)) {
    throw new Error(`INVALID_CASHIER_TRANSITION: Order is already in status ${order.status}`);
  }

  markPaid(order, new Date().toISOString());
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
  order.previousStatus = order.status;
  order.status = targetStatus;
  order.updatedAt = now;

  if (targetStatus === 'in_wok') {
    for (const p of order.portions) {
      if (!p.firedAt) p.firedAt = now;
    }
  } else if (targetStatus === 'plating') {
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
 * Takes back the last crew move of an order (mis-tap), within UNDO_WINDOW_MS:
 * plating -> back to the wok queue, ready -> plating, completed -> ready.
 */
export function undoLastMove(orderId: string, now: number = Date.now()): Order {
  const order = ordersStore.find((o) => o.id === orderId);
  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }
  const previous = order.previousStatus;
  const undoable =
    (order.status === 'plating' && (previous === 'received' || previous === 'in_wok')) ||
    (order.status === 'ready' && previous === 'plating') ||
    (order.status === 'completed' && previous === 'ready');
  if (!undoable || !previous) {
    throw new Error('INVALID_UNDO: Dieser Schritt kann nicht zurückgenommen werden.');
  }
  if (now - Date.parse(order.updatedAt) > UNDO_WINDOW_MS) {
    throw new Error('INVALID_UNDO: Zu spät, der Schritt liegt mehr als eine Minute zurück.');
  }

  if (order.status === 'completed') {
    if (!reclaimZueriCode(order.zueriCode.plz)) {
      throw new Error('INVALID_UNDO: Der Züri-Code ist bereits neu vergeben.');
    }
    order.completedAt = undefined;
  } else if (order.status === 'ready') {
    order.readyAt = undefined;
  } else {
    order.platedAt = undefined;
  }

  order.status = previous;
  order.previousStatus = undefined;
  order.updatedAt = new Date(now).toISOString();
  persistOrders();
  return order;
}

export interface WokBatchResult {
  variant: DishVariantId;
  portions: number;
  codes: string[];
}

/**
 * Station 2 (Koch): starts one wok batch of a variant. Takes the oldest paid portions that
 * are not in the wok yet, at most one wok load, and marks them as cooking.
 * The Schöpfer then sees which boxes are actually cooked.
 */
export function startWokBatch(variant: unknown, now: number = Date.now()): WokBatchResult {
  if (typeof variant !== 'string' || !Object.prototype.hasOwnProperty.call(MENU_DISHES, variant)) {
    throw new Error('INVALID_DISH_VARIANT');
  }
  const { wokBatchSize } = getFeatureFlags();
  const iso = new Date(now).toISOString();
  const queue = ordersStore
    .filter((o) => o.status === 'received' || o.status === 'in_wok')
    .sort((a, b) => Date.parse(a.paidAt || a.createdAt) - Date.parse(b.paidAt || b.createdAt));

  let fired = 0;
  const codes: string[] = [];
  for (const order of queue) {
    if (fired >= wokBatchSize) break;
    let touched = false;
    for (const portion of order.portions) {
      if (fired >= wokBatchSize) break;
      if (portion.variant !== variant || portion.firedAt) continue;
      portion.firedAt = iso;
      fired += 1;
      touched = true;
    }
    if (touched) {
      codes.push(order.zueriCode.formatted);
      if (order.status === 'received') {
        order.previousStatus = undefined;
        order.status = 'in_wok';
      }
      order.updatedAt = iso;
    }
  }

  if (fired > 0) persistOrders();
  return { variant: variant as DishVariantId, portions: fired, codes };
}

// --- Payment webhook ---------------------------------------------------------------------

export type PaymentEventOutcome =
  | 'PAID'
  | 'ALREADY_PAID'
  | 'DUPLICATE_EVENT'
  | 'FALLBACK'
  | 'REFUND_DUE'
  | 'IGNORED'
  | 'UNKNOWN_ORDER';

function flagRefund(order: Order, reason: RefundReason, event: PaymentEvent, nowIso: string): void {
  order.refundDue = {
    reason,
    amountChf: event.amountRappen / 100,
    providerRef: event.providerRef,
    flaggedAt: nowIso,
  };
  order.updatedAt = nowIso;
}

function rememberEvent(eventId: string): void {
  processedPaymentEvents.push(eventId);
  if (processedPaymentEvents.length > MAX_PROCESSED_EVENTS) {
    processedPaymentEvents = processedPaymentEvents.slice(-MAX_PROCESSED_EVENTS);
  }
  writeJsonAtomic('payment-events', processedPaymentEvents);
}

/**
 * Applies one VERIFIED provider event to its order. Safe to call several times with the
 * same event (providers retry webhooks).
 *
 * - succeeded, order still unpaid         -> paid, into the wok queue
 * - succeeded, amount or currency differs -> not released, cashier alert + refund flag
 * - succeeded, order already settled by the cashier or cancelled -> refund flag, never lost
 * - failed / expired, order waiting for the provider -> payment_error_fallback (code stays reserved)
 */
export function applyPaymentEvent(event: PaymentEvent, now: number = Date.now()): PaymentEventOutcome {
  if (processedPaymentEvents.includes(event.id)) return 'DUPLICATE_EVENT';

  const order = ordersStore.find((o) => o.id === event.orderId);
  if (!order || !order.payment || order.payment.providerRef !== event.providerRef) {
    rememberEvent(event.id);
    console.error(
      `[holy-basil] Zahlungs-Event ${event.id} passt zu keiner Bestellung (${event.orderId}).`
    );
    return 'UNKNOWN_ORDER';
  }

  const nowIso = new Date(now).toISOString();
  let outcome: PaymentEventOutcome = 'IGNORED';

  if (event.type === 'payment.succeeded') {
    const amountOk =
      event.currency === 'CHF' && event.amountRappen === chfToRappen(order.totalChf);

    if (order.payment.settledEventId) {
      outcome = 'ALREADY_PAID';
    } else if (!amountOk) {
      // Money arrived, but not the amount of this order: a human has to look at it.
      flagRefund(order, 'AMOUNT_MISMATCH', event, nowIso);
      if (order.status === 'pending_payment') {
        order.status = 'payment_error_fallback';
        order.paymentStatus = 'payment_error_fallback';
      }
      order.payment.failureReason = 'AMOUNT_MISMATCH';
      recordPaymentAttempt('fallback');
      outcome = 'REFUND_DUE';
    } else if (order.status === 'pending_payment' || order.status === 'payment_error_fallback') {
      markPaid(order, nowIso);
      order.payment.settledEventId = event.id;
      recordPaymentAttempt('success');
      outcome = 'PAID';
    } else if (order.status === 'cancelled') {
      flagRefund(order, 'PAID_AFTER_CANCEL', event, nowIso);
      order.payment.settledEventId = event.id;
      outcome = 'REFUND_DUE';
    } else {
      // The cashier already took the money by hand: the guest paid twice.
      flagRefund(order, 'DOUBLE_PAYMENT', event, nowIso);
      order.payment.settledEventId = event.id;
      outcome = 'REFUND_DUE';
    }
  } else if (order.status === 'pending_payment') {
    order.status = 'payment_error_fallback';
    order.paymentStatus = 'payment_error_fallback';
    order.payment.failureReason = event.type;
    order.updatedAt = nowIso;
    recordPaymentAttempt('fallback');
    outcome = 'FALLBACK';
  }

  rememberEvent(event.id);
  persistOrders();
  return outcome;
}

/** The cashier refunded the guest: clears the refund flag. */
export function resolveRefund(orderId: string, note?: string): Order {
  const order = ordersStore.find((o) => o.id === orderId);
  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }
  if (!order.refundDue || order.refundDue.resolvedAt) {
    throw new Error('INVALID_REFUND: Keine offene Rückerstattung.');
  }
  const now = new Date().toISOString();
  order.refundDue.resolvedAt = now;
  order.updatedAt = now;
  if (order.status === 'cancelled') {
    order.paymentStatus = 'refunded';
  }
  const cleaned = cleanNote(note);
  if (cleaned) order.manualResolutionNote = cleaned;
  persistOrders();
  return order;
}

/**
 * Cancels unpaid orders nobody paid for within PENDING_ORDER_TTL_MS, so abandoned
 * orders do not block Züri-Codes for the rest of the day. Paid orders never expire.
 * If a payment still arrives afterwards, the webhook raises a refund flag.
 */
export function expireStalePendingOrders(
  now: number = Date.now(),
  maxAgeMs: number = PENDING_ORDER_TTL_MS
): number {
  let expired = 0;
  for (const order of ordersStore) {
    if (!UNPAID_STATUSES.includes(order.status)) continue;
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

/**
 * Moves finished orders (handed over or cancelled, no open refund) that are older than
 * `maxAgeMs` into a monthly archive file, so the live file stays small.
 */
export function archiveFinishedOrders(
  now: number = Date.now(),
  maxAgeMs: number = ARCHIVE_AFTER_MS
): number {
  const keep: Order[] = [];
  const byMonth = new Map<string, Order[]>();
  for (const order of ordersStore) {
    const finished = order.status === 'completed' || order.status === 'cancelled';
    const age = now - Date.parse(order.updatedAt);
    if (finished && !hasOpenRefund(order) && age >= maxAgeMs) {
      const month = order.createdAt.slice(0, 7);
      byMonth.set(month, [...(byMonth.get(month) || []), order]);
    } else {
      keep.push(order);
    }
  }
  let moved = 0;
  for (const [month, orders] of byMonth) {
    const name = `orders-archive-${month}`;
    const existing = readJson<Order[]>(name, []);
    writeJsonAtomic(name, [...(Array.isArray(existing) ? existing : []), ...orders]);
    moved += orders.length;
  }
  if (moved > 0) {
    ordersStore = keep;
    persistOrders();
  }
  return moved;
}

export function getWokDemand(now: number = Date.now()): WokDemandSummary {
  return getWokDemandSummary(ordersStore, now);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
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
  b2bInquiriesStore = [];
  processedPaymentEvents = [];
  liveLocationId = 'loc_1';
  inFlightByIdempotencyKey.clear();
  resetZueriCodeAllocations();
  resetNewsletter();
  resetRateLimits();
  resetOutbox();
  resetPaymentService();
}
