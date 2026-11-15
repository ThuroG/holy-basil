import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach } from 'vitest';
import { handleApiRequest } from '../../src/lib/apiHandler.js';
import {
  resetOrderStore,
  createOrder,
  getOrderById,
  getActiveOrders,
  getWokDemand,
  applyPaymentEvent,
  confirmOrderPaymentAtCashier,
  expireStalePendingOrders,
  loadStoreFromDisk,
  PENDING_ORDER_TTL_MS,
} from '../../src/lib/orderStore.js';
import { resetFeatureFlags, setDemoPaymentsEnabled } from '../../src/config/features.js';
import { buildTestWebhook, chfToRappen, PaymentEvent } from '../../src/lib/paymentService.js';
import { getSlaMetrics, resetSlaMetrics } from '../../src/lib/response.js';
import { isZueriCodeAllocated } from '../../src/lib/zueriCodes.js';
import { Order } from '../../src/lib/types.js';

// Own data folder, so the restart test cannot be disturbed by other test files.
process.env.HB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'holy-basil-payments-'));

const guest = (req: Parameters<typeof handleApiRequest>[0]) => handleApiRequest(req);
const crew = (req: Parameters<typeof handleApiRequest>[0]) => handleApiRequest({ ...req, isCrew: true });

async function twintOrder(): Promise<Order> {
  return createOrder({ portions: [{ variant: 'chicken', addKaiDao: true }], paymentMethod: 'twint' });
}

function eventFor(order: Order, overrides: Partial<PaymentEvent> = {}): Omit<PaymentEvent, 'id'> & { id?: string } {
  return {
    type: 'payment.succeeded',
    providerRef: order.payment!.providerRef,
    orderId: order.id,
    amountRappen: chfToRappen(order.totalChf),
    currency: 'CHF',
    ...overrides,
  };
}

/** Sends a webhook the way the provider does: raw body plus signature header. */
function webhook(signed: { rawBody: string; headers: Record<string, string> }) {
  return guest({
    method: 'POST',
    pathname: '/api/webhooks/payment',
    rawBody: signed.rawBody,
    body: JSON.parse(signed.rawBody),
    headers: signed.headers,
  });
}

describe('Digital payment: checkout, signed webhook and fallbacks', () => {
  beforeEach(() => {
    resetFeatureFlags();
    setDemoPaymentsEnabled(true);
    resetOrderStore();
    resetSlaMetrics();
  });

  it('keeps a digital order out of the wok until the signed webhook confirms the payment', async () => {
    const res = await guest({
      method: 'POST',
      pathname: '/api/orders',
      body: { portions: [{ variant: 'chicken' }], paymentMethod: 'twint' },
    });
    expect(res.statusCode).toBe(201);
    const pub = (res.body as any).data.order;
    expect(pub.status).toBe('pending_payment');
    expect(pub.paymentUrl).toMatch(/^\/pay\/test\/test_[0-9a-f]+$/);
    // The guest view never carries provider internals
    expect(pub.payment).toBeUndefined();
    expect(getWokDemand().totalActivePortions).toBe(0);

    const order = getOrderById(pub.id)!;
    const ok = await webhook(buildTestWebhook(eventFor(order)));
    expect(ok.statusCode).toBe(200);
    expect((ok.body as any).data.outcome).toBe('PAID');

    const paid = getOrderById(pub.id)!;
    expect(paid.status).toBe('received');
    expect(paid.paymentStatus).toBe('paid');
    expect(paid.paidAt).toBeTruthy();
    expect(getWokDemand().totalActivePortions).toBe(1);
    expect(getSlaMetrics().paymentSuccesses).toBe(1);

    // Once paid, the ticket no longer shows a payment link
    const ticket = await guest({ method: 'GET', pathname: `/api/orders/${pub.id}` });
    expect((ticket.body as any).data.order.paymentUrl).toBeUndefined();
  });

  it('rejects webhooks with a wrong signature and changes nothing', async () => {
    const order = await twintOrder();
    const signed = buildTestWebhook(eventFor(order));

    const forged = await webhook({ rawBody: signed.rawBody, headers: { 'x-hb-signature': 't=1,v1=' + 'a'.repeat(64) } });
    expect(forged.statusCode).toBe(400);
    expect((forged.body as any).error.code).toBe('WEBHOOK_REJECTED');

    const unsigned = await webhook({ rawBody: signed.rawBody, headers: {} });
    expect(unsigned.statusCode).toBe(400);

    // The signature covers the raw bytes: a re-serialised body with another amount fails
    const tampered = await webhook({ rawBody: signed.rawBody.replace('1750', '1'), headers: signed.headers });
    expect(tampered.statusCode).toBe(400);

    expect(getOrderById(order.id)!.status).toBe('pending_payment');
  });

  it('answers 404 on the webhook route when no provider is active', async () => {
    const order = await twintOrder();
    const signed = buildTestWebhook(eventFor(order));
    setDemoPaymentsEnabled(false);
    expect((await webhook(signed)).statusCode).toBe(404);
  });

  it('processes a repeated event only once', async () => {
    const order = await twintOrder();
    const signed = buildTestWebhook(eventFor(order, { id: 'evt_same' }));
    expect(((await webhook(signed)).body as any).data.outcome).toBe('PAID');
    expect(((await webhook(signed)).body as any).data.outcome).toBe('DUPLICATE_EVENT');

    // A second, different success event for the same payment does not pay twice either
    const again = await webhook(buildTestWebhook(eventFor(order, { id: 'evt_other' })));
    expect((again.body as any).data.outcome).toBe('ALREADY_PAID');
    expect(getOrderById(order.id)!.refundDue).toBeUndefined();
    expect(getSlaMetrics().paymentSuccesses).toBe(1);
  });

  it('moves a failed or expired payment to payment_error_fallback and keeps the code', async () => {
    for (const type of ['payment.failed', 'payment.expired'] as const) {
      const order = await twintOrder();
      const res = await webhook(buildTestWebhook(eventFor(order, { type })));
      expect((res.body as any).data.outcome).toBe('FALLBACK');
      const after = getOrderById(order.id)!;
      expect(after.status).toBe('payment_error_fallback');
      expect(after.payment!.failureReason).toBe(type);
      expect(isZueriCodeAllocated(after.zueriCode.plz)).toBe(true);

      // The cashier settles it by hand
      confirmOrderPaymentAtCashier(order.id, 'Bar kassiert');
      expect(getOrderById(order.id)!.status).toBe('received');
    }
  });

  it('puts the order into payment_error_fallback when the checkout cannot be opened in time', async () => {
    const order = await createOrder(
      { portions: [{ variant: 'vegan' }], paymentMethod: 'card' },
      { simulatedCheckoutDelayMs: 900 }
    );
    expect(order.status).toBe('payment_error_fallback');
    expect(order.payment).toBeUndefined();
    expect(order.manualResolutionNote).toContain('PAYMENT_GATEWAY_TIMEOUT');
    expect(isZueriCodeAllocated(order.zueriCode.plz)).toBe(true);
    expect(getSlaMetrics().paymentFallbacksTriggered).toBe(1);
  });

  it('does not release an order when the paid amount or currency differs', async () => {
    const wrongAmount = await twintOrder();
    const res = await webhook(buildTestWebhook(eventFor(wrongAmount, { amountRappen: 100 })));
    expect((res.body as any).data.outcome).toBe('REFUND_DUE');
    const a = getOrderById(wrongAmount.id)!;
    expect(a.status).toBe('payment_error_fallback');
    expect(a.refundDue).toMatchObject({ reason: 'AMOUNT_MISMATCH', amountChf: 1 });
    expect(getWokDemand().totalActivePortions).toBe(0);

    const wrongCurrency = await twintOrder();
    await webhook(buildTestWebhook(eventFor(wrongCurrency, { currency: 'EUR' })));
    expect(getOrderById(wrongCurrency.id)!.refundDue?.reason).toBe('AMOUNT_MISMATCH');
  });

  it('flags a refund when the payment arrives after the order was cancelled', async () => {
    const order = await twintOrder();
    const created = Date.parse(order.createdAt);
    expect(expireStalePendingOrders(created + PENDING_ORDER_TTL_MS + 1000)).toBe(1);
    expect(getOrderById(order.id)!.status).toBe('cancelled');
    expect(getActiveOrders().length).toBe(0);

    const late = await webhook(buildTestWebhook(eventFor(order)));
    expect((late.body as any).data.outcome).toBe('REFUND_DUE');
    const after = getOrderById(order.id)!;
    expect(after.status).toBe('cancelled');
    expect(after.refundDue).toMatchObject({ reason: 'PAID_AFTER_CANCEL', amountChf: 17.5 });
    // The cashier sees it until the money went back
    expect(getActiveOrders().map((o) => o.id)).toEqual([order.id]);

    const guestTry = await guest({
      method: 'PATCH',
      pathname: `/api/orders/${order.id}`,
      body: { action: 'refund_done' },
    });
    expect(guestTry.statusCode).toBe(401);

    const done = await crew({
      method: 'PATCH',
      pathname: `/api/orders/${order.id}`,
      body: { action: 'refund_done' },
    });
    expect(done.statusCode).toBe(200);
    expect(getOrderById(order.id)!.paymentStatus).toBe('refunded');
    expect(getActiveOrders().length).toBe(0);

    const twice = await crew({
      method: 'PATCH',
      pathname: `/api/orders/${order.id}`,
      body: { action: 'refund_done' },
    });
    expect(twice.statusCode).toBe(400);
  });

  it('flags a double payment when the cashier took cash and the webhook still arrives', async () => {
    const order = await twintOrder();
    confirmOrderPaymentAtCashier(order.id, 'Gast zahlte bar');
    const res = await webhook(buildTestWebhook(eventFor(order)));
    expect((res.body as any).data.outcome).toBe('REFUND_DUE');
    const after = getOrderById(order.id)!;
    expect(after.status).toBe('received'); // the food is still made
    expect(after.refundDue?.reason).toBe('DOUBLE_PAYMENT');
  });

  it('acknowledges events for unknown orders without touching anything', async () => {
    const order = await twintOrder();
    const unknown = await webhook(buildTestWebhook(eventFor(order, { orderId: 'ord_nope' })));
    expect(unknown.statusCode).toBe(200);
    expect((unknown.body as any).data.outcome).toBe('UNKNOWN_ORDER');

    // Right order id, but a payment reference that belongs to nobody
    const wrongRef = await webhook(buildTestWebhook(eventFor(order, { providerRef: 'test_other' })));
    expect((wrongRef.body as any).data.outcome).toBe('UNKNOWN_ORDER');
    expect(getOrderById(order.id)!.status).toBe('pending_payment');
  });

  it('never expires a paid order', async () => {
    const order = await twintOrder();
    applyPaymentEvent({ ...eventFor(order), id: 'evt_paid' } as PaymentEvent);
    const far = Date.parse(order.createdAt) + 10 * PENDING_ORDER_TTL_MS;
    expect(expireStalePendingOrders(far)).toBe(0);
    expect(getOrderById(order.id)!.status).toBe('received');
  });

  it('remembers processed events and payment state across a restart', async () => {
    const order = await twintOrder();
    const signed = buildTestWebhook(eventFor(order, { id: 'evt_restart' }));
    await webhook(signed);

    resetOrderStore();
    loadStoreFromDisk();
    setDemoPaymentsEnabled(true);

    expect(getOrderById(order.id)!.status).toBe('received');
    expect(getOrderById(order.id)!.payment!.settledEventId).toBe('evt_restart');
    // Same event again after the restart: recognised from the stored event list
    expect(applyPaymentEvent(JSON.parse(signed.rawBody))).toBe('DUPLICATE_EVENT');
  });

  it('runs the test payment page through the same signed webhook path', async () => {
    const order = await twintOrder();
    const ref = order.payment!.providerRef;

    const bad = await guest({ method: 'POST', pathname: `/api/payments/test/${ref}`, body: { outcome: 'free' } });
    expect(bad.statusCode).toBe(400);
    const missing = await guest({ method: 'POST', pathname: '/api/payments/test/test_nope', body: { outcome: 'succeeded' } });
    expect(missing.statusCode).toBe(404);

    const lost = await guest({ method: 'POST', pathname: `/api/payments/test/${ref}`, body: { outcome: 'lost' } });
    expect((lost.body as any).data.outcome).toBe('NO_WEBHOOK_SENT');
    expect(getOrderById(order.id)!.status).toBe('pending_payment');

    const ok = await guest({ method: 'POST', pathname: `/api/payments/test/${ref}`, body: { outcome: 'succeeded' } });
    expect((ok.body as any).data).toEqual({ outcome: 'PAID', returnUrl: `/order/${order.id}` });
    expect(getOrderById(order.id)!.status).toBe('received');

    // Outside demo mode the route does not exist
    setDemoPaymentsEnabled(false);
    const off = await guest({ method: 'POST', pathname: `/api/payments/test/${ref}`, body: { outcome: 'succeeded' } });
    expect(off.statusCode).toBe(404);
  });
});
