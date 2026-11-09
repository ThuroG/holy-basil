import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleApiRequest } from '../../src/lib/apiHandler.js';
import {
  resetOrderStore,
  createOrder,
  advanceOrderStatus,
  confirmOrderPaymentAtCashier,
  expireStalePendingOrders,
  loadStoreFromDisk,
  getOrderById,
  getAllOrders,
  getB2BInquiries,
  getNewsletterSubscribers,
  getTruckLocations,
  PENDING_ORDER_TTL_MS,
} from '../../src/lib/orderStore.js';
import {
  resetFeatureFlags,
  setDemoPaymentsEnabled,
  setCustomSpiceLevelsEnabled,
  getFeatureFlags,
} from '../../src/config/features.js';
import { resetSlaMetrics } from '../../src/lib/response.js';
import { resetAuth, isCrewSession, CREW_COOKIE_NAME } from '../../src/lib/auth.js';
import { isZueriCodeAllocated } from '../../src/lib/zueriCodes.js';

// Own data folder for this file, so parallel test files cannot interfere with the restart test.
process.env.HB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'holy-basil-security-'));

const guest = (req: Parameters<typeof handleApiRequest>[0]) => handleApiRequest(req);
const crew = (req: Parameters<typeof handleApiRequest>[0]) =>
  handleApiRequest({ ...req, isCrew: true });

async function cashOrder() {
  return createOrder({ portions: [{ variant: 'vegan' }], paymentMethod: 'cash' });
}

describe('Access control: guests vs. crew', () => {
  beforeEach(() => {
    resetFeatureFlags();
    resetOrderStore();
    resetSlaMetrics();
    resetAuth('424242');
  });

  it('blocks every crew route for guests with 401', async () => {
    const order = await cashOrder();
    const blocked: Array<Parameters<typeof handleApiRequest>[0]> = [
      { method: 'GET', pathname: '/api/orders' },
      { method: 'PATCH', pathname: `/api/orders/${order.id}`, body: { action: 'confirm_cash' } },
      { method: 'PATCH', pathname: `/api/orders/${order.id}`, body: { status: 'cancelled' } },
      { method: 'PATCH', pathname: '/api/features', body: { enableCustomSpiceLevels: true } },
      { method: 'GET', pathname: '/api/wok-demand' },
      { method: 'GET', pathname: '/api/newsletter' },
      { method: 'GET', pathname: '/api/b2b' },
      { method: 'PATCH', pathname: '/api/locations', body: { locationId: 'loc_2' } },
    ];
    for (const req of blocked) {
      const res = await guest(req);
      expect(res.statusCode, `${req.method} ${req.pathname}`).toBe(401);
    }

    // The guest could not free their own unpaid order
    expect(getOrderById(order.id)!.status).toBe('pending_cash');
    expect(getFeatureFlags().enableCustomSpiceLevels).toBe(false);
  });

  it('shows guests only the public view of an order and the board only codes', async () => {
    const created = await guest({
      method: 'POST',
      pathname: '/api/orders',
      headers: { 'idempotency-key': 'secret-key-1' },
      body: { portions: [{ variant: 'chicken' }], paymentMethod: 'cash', customerNote: 'privat' },
    });
    expect(created.statusCode).toBe(201);
    const publicOrder = (created.body as any).data.order;
    expect(publicOrder.idempotencyKey).toBeUndefined();
    expect(publicOrder.correlationId).toBeUndefined();
    expect(publicOrder.customerNote).toBeUndefined();
    expect(publicOrder.id).toMatch(/^ord_[0-9a-f]{24}$/);

    const fetched = await guest({ method: 'GET', pathname: `/api/orders/${publicOrder.id}` });
    expect((fetched.body as any).data.order.idempotencyKey).toBeUndefined();

    confirmOrderPaymentAtCashier(publicOrder.id);
    const board = await guest({ method: 'GET', pathname: '/api/board' });
    const entries = (board.body as any).data.entries;
    expect(entries).toEqual([
      { plz: publicOrder.zueriCode.plz, quarter: publicOrder.zueriCode.quarter, phase: 'preparing' },
    ]);
  });

  it('gives guests a bare health probe and the crew the metrics', async () => {
    const pub = await guest({ method: 'GET', pathname: '/api/health' });
    expect((pub.body as any).data).toEqual({ status: 'healthy' });
    const priv = await crew({ method: 'GET', pathname: '/api/health' });
    expect((priv.body as any).data.metrics).toBeDefined();
  });

  it('logs the crew in with the PIN, rejects wrong PINs and rate-limits guessing', async () => {
    const wrong = await guest({
      method: 'POST',
      pathname: '/api/crew/login',
      body: { pin: '000000' },
      clientKey: 'ip-a',
    });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.headers).toBeUndefined();

    const ok = await guest({
      method: 'POST',
      pathname: '/api/crew/login',
      body: { pin: '424242' },
      clientKey: 'ip-a',
    });
    expect(ok.statusCode).toBe(200);
    const cookie = ok.headers!['Set-Cookie'];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    const token = cookie.split(';')[0].split('=')[1];
    expect(cookie.startsWith(`${CREW_COOKIE_NAME}=`)).toBe(true);
    expect(isCrewSession(token)).toBe(true);

    const session = await crew({ method: 'GET', pathname: '/api/crew/session' });
    expect((session.body as any).data.crew).toBe(true);

    const out = await crew({ method: 'POST', pathname: '/api/crew/logout', sessionToken: token });
    expect(out.statusCode).toBe(200);
    expect(isCrewSession(token)).toBe(false);

    for (let i = 0; i < 8; i++) {
      await guest({ method: 'POST', pathname: '/api/crew/login', body: { pin: 'x' }, clientKey: 'ip-b' });
    }
    const locked = await guest({
      method: 'POST',
      pathname: '/api/crew/login',
      body: { pin: '424242' },
      clientKey: 'ip-b',
    });
    expect(locked.statusCode).toBe(429);
  });
});

describe('Payments: cash only unless demo mode is on', () => {
  beforeEach(() => {
    resetFeatureFlags();
    resetOrderStore();
    resetSlaMetrics();
  });

  it('rejects TWINT and card by default and never marks an order paid without the cashier', async () => {
    for (const paymentMethod of ['twint', 'card']) {
      const res = await guest({
        method: 'POST',
        pathname: '/api/orders',
        body: { portions: [{ variant: 'vegan' }], paymentMethod },
      });
      expect(res.statusCode).toBe(400);
    }
    expect(getAllOrders().length).toBe(0);

    const features = await guest({ method: 'GET', pathname: '/api/features' });
    expect((features.body as any).data.paymentMethods).toEqual(['cash']);
  });

  it('lets only the crew trigger a simulated payment failure, and only in demo mode', async () => {
    setDemoPaymentsEnabled(true);
    const body = {
      portions: [{ variant: 'vegan' }],
      paymentMethod: 'card',
      simulatePaymentFailure: true,
    };
    const asGuest = await guest({ method: 'POST', pathname: '/api/orders', body });
    expect((asGuest.body as any).data.order.status).toBe('received');

    const asCrew = await crew({ method: 'POST', pathname: '/api/orders', body });
    expect((asCrew.body as any).data.order.status).toBe('payment_error_fallback');
  });
});

describe('Order status machine', () => {
  beforeEach(() => {
    resetFeatureFlags();
    resetOrderStore();
  });

  it('allows only forward moves and rejects unknown states', async () => {
    const order = await cashOrder();
    confirmOrderPaymentAtCashier(order.id);

    expect(() => advanceOrderStatus(order.id, 'completed')).toThrow('INVALID_STATUS_TRANSITION');
    expect(() => advanceOrderStatus(order.id, 'hacked' as any)).toThrow('INVALID_TARGET_STATUS');
    expect(() => advanceOrderStatus(order.id, '__proto__' as any)).toThrow('INVALID_TARGET_STATUS');

    advanceOrderStatus(order.id, 'in_wok');
    advanceOrderStatus(order.id, 'plating');
    expect(() => advanceOrderStatus(order.id, 'received')).toThrow('INVALID_STATUS_TRANSITION');
    advanceOrderStatus(order.id, 'ready');
    advanceOrderStatus(order.id, 'completed');

    // A finished order can never come back to life
    for (const target of ['received', 'ready', 'cancelled', 'completed'] as const) {
      expect(() => advanceOrderStatus(order.id, target)).toThrow('INVALID_STATUS_TRANSITION');
    }
    // Its code is cooling down, not handed to the next guest right away
    const next = await createOrder({
      portions: [{ variant: 'vegan' }],
      paymentMethod: 'cash',
      preferredPlz: order.zueriCode.plz,
    });
    expect(next.zueriCode.plz).not.toBe(order.zueriCode.plz);
  });

  it('lets the crew cancel an unpaid order and frees its code', async () => {
    const order = await cashOrder();
    expect(isZueriCodeAllocated(order.zueriCode.plz)).toBe(true);
    const res = await crew({
      method: 'PATCH',
      pathname: `/api/orders/${order.id}`,
      body: { status: 'cancelled' },
    });
    expect(res.statusCode).toBe(200);
    expect(isZueriCodeAllocated(order.zueriCode.plz)).toBe(false);
    expect((await crew({ method: 'GET', pathname: '/api/orders' })).body as any).toMatchObject({
      data: { orders: [] },
    });
  });

  it('cancels unpaid orders after the time limit but leaves paid ones alone', async () => {
    const stale = await cashOrder();
    const paid = await cashOrder();
    confirmOrderPaymentAtCashier(paid.id);

    const created = Date.parse(stale.createdAt);
    expect(expireStalePendingOrders(created + PENDING_ORDER_TTL_MS - 1000)).toBe(0);
    expect(expireStalePendingOrders(created + PENDING_ORDER_TTL_MS + 1000)).toBe(1);

    expect(getOrderById(stale.id)!.status).toBe('cancelled');
    expect(getOrderById(paid.id)!.status).toBe('received');
    expect(isZueriCodeAllocated(stale.zueriCode.plz)).toBe(false);
  });
});

describe('Input validation', () => {
  beforeEach(() => {
    resetFeatureFlags();
    resetOrderStore();
  });

  it('rejects script payloads and wrong types in spice level, portions and drinks', async () => {
    setCustomSpiceLevelsEnabled(true);
    const bad: unknown[] = [
      { portions: [{ variant: 'vegan', spiceLevel: '<img src=x onerror=alert(1)>' }], paymentMethod: 'cash' },
      { portions: [{ variant: 'vegan', spiceLevel: 42 }], paymentMethod: 'cash' },
      { portions: [null], paymentMethod: 'cash' },
      { portions: ['vegan'], paymentMethod: 'cash' },
      { portions: [{ variant: 'constructor' }], paymentMethod: 'cash' },
      { portions: [{ variant: 'vegan' }], drinks: 'tea', paymentMethod: 'cash' },
      { portions: [{ variant: 'vegan' }], drinks: [{ drinkId: 'toString', quantity: 1 }], paymentMethod: 'cash' },
      { portions: [{ variant: 'vegan' }], drinks: [{ drinkId: 'thai_iced_tea', quantity: 'viele' }], paymentMethod: 'cash' },
    ];
    for (const body of bad) {
      const res = await guest({ method: 'POST', pathname: '/api/orders', body });
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
    }
    expect(getAllOrders().length).toBe(0);

    // Non-object bodies and odd preferred codes do not crash the server
    for (const body of [null, 'text', [1, 2], 7]) {
      const res = await guest({ method: 'POST', pathname: '/api/orders', body });
      expect(res.statusCode).toBe(422);
    }
    const odd = await guest({
      method: 'POST',
      pathname: '/api/orders',
      body: { portions: [{ variant: 'vegan' }], paymentMethod: 'cash', preferredPlz: { a: 1 } },
    });
    expect(odd.statusCode).toBe(201);
  });

  it('creates exactly one order when the same idempotency key arrives twice at once', async () => {
    const input = {
      portions: [{ variant: 'vegan' as const }],
      paymentMethod: 'cash' as const,
      idempotencyKey: 'double-tap',
    };
    const [a, b] = await Promise.all([createOrder(input), createOrder(input)]);
    expect(a.id).toBe(b.id);
    expect(getAllOrders().length).toBe(1);
  });

  it('answers an unknown order id with 404', async () => {
    const res = await crew({ method: 'PATCH', pathname: '/api/orders/x', body: { status: 'ready' } });
    expect(res.statusCode).toBe(404);
  });
});

describe('Persistence across restarts', () => {
  beforeEach(() => {
    resetFeatureFlags();
    resetOrderStore();
  });

  it('restores orders, codes, newsletter, B2B inquiries and settings from disk', async () => {
    const active = await cashOrder();
    const done = await cashOrder();
    confirmOrderPaymentAtCashier(done.id);
    advanceOrderStatus(done.id, 'plating');
    advanceOrderStatus(done.id, 'ready');
    advanceOrderStatus(done.id, 'completed');

    await guest({ method: 'POST', pathname: '/api/newsletter', body: { email: 'fan@zueri.ch' } });
    await guest({
      method: 'POST',
      pathname: '/api/b2b',
      body: { companyName: 'Züri Tech AG', email: 'alex@zueritech.ch', guestCount: 40 },
    });
    await crew({ method: 'PATCH', pathname: '/api/locations', body: { locationId: null } });
    await crew({ method: 'PATCH', pathname: '/api/features', body: { enableCustomSpiceLevels: true } });

    // Simulate a restart: memory is wiped, then the server loads from disk
    resetOrderStore();
    resetFeatureFlags();
    expect(getAllOrders().length).toBe(0);

    const loaded = loadStoreFromDisk();
    expect(loaded).toEqual({ orders: 2, subscribers: 1, inquiries: 1 });
    expect(getOrderById(active.id)!.status).toBe('pending_cash');
    expect(isZueriCodeAllocated(active.zueriCode.plz)).toBe(true);
    expect(isZueriCodeAllocated(done.zueriCode.plz)).toBe(false);
    expect(getNewsletterSubscribers()[0].email).toBe('fan@zueri.ch');
    expect(getB2BInquiries()[0].companyName).toBe('Züri Tech AG');
    expect(getTruckLocations().some((l) => l.status === 'live_now')).toBe(false);
    expect(getFeatureFlags().enableCustomSpiceLevels).toBe(true);
  });

  it('survives a broken data file', () => {
    const dir = process.env.HB_DATA_DIR!;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'orders.json'), '{ kaputt', 'utf8');
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadStoreFromDisk().orders).toBe(0);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
    fs.writeFileSync(path.join(dir, 'orders.json'), '[]', 'utf8');
  });
});
