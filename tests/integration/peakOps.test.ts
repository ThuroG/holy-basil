import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach } from 'vitest';
import { handleApiRequest } from '../../src/lib/apiHandler.js';
import {
  resetOrderStore,
  createOrder,
  confirmOrderPaymentAtCashier,
  advanceOrderStatus,
  startWokBatch,
  undoLastMove,
  getWokDemand,
  getOrderById,
  getAllOrders,
  getBoardEntries,
  archiveFinishedOrders,
  loadStoreFromDisk,
  setLiveTruckLocation,
  UNDO_WINDOW_MS,
  ARCHIVE_AFTER_MS,
} from '../../src/lib/orderStore.js';
import { resetFeatureFlags, getFeatureFlags } from '../../src/config/features.js';
import { complianceConfig } from '../../src/config/compliance.js';
import { ZUERI_CODE_POOL, isZueriCodeAllocated } from '../../src/lib/zueriCodes.js';
import { checkRateLimit, resetRateLimits, RATE_LIMITS, pruneRateLimits } from '../../src/lib/rateLimit.js';
import { getOutbox } from '../../src/lib/mailer.js';
import {
  requestSubscription,
  confirmSubscription,
  unsubscribe,
  purgeExpiredPendingSubscriptions,
  getNewsletterSubscribers,
  CONFIRM_TTL_MS,
} from '../../src/lib/newsletter.js';
import { NEWSLETTER_CONSENT, getLegalPlaceholders, legalConfig } from '../../src/config/legal.js';
import { renderOrderPageHtml } from '../../src/views/orderPage.js';
import { CreateOrderInput } from '../../src/lib/types.js';

process.env.HB_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'holy-basil-peak-'));

const guest = (req: Parameters<typeof handleApiRequest>[0]) => handleApiRequest(req);
const crew = (req: Parameters<typeof handleApiRequest>[0]) => handleApiRequest({ ...req, isCrew: true });

async function paidOrder(portions: CreateOrderInput['portions']) {
  const order = await createOrder({ portions, paymentMethod: 'cash' });
  return confirmOrderPaymentAtCashier(order.id);
}

function reset() {
  resetFeatureFlags();
  resetOrderStore();
}

describe('Wok batches: the cook starts batches, the Schöpfer sees what is cooking', () => {
  beforeEach(reset);

  it('takes the oldest waiting portions of a variant, at most one wok load', async () => {
    const first = await paidOrder([{ variant: 'chicken' }, { variant: 'chicken' }, { variant: 'vegan' }]);
    const second = await paidOrder([{ variant: 'chicken' }, { variant: 'chicken' }, { variant: 'chicken' }]);
    // Make the queue order explicit: `first` was paid earlier
    getOrderById(first.id)!.paidAt = new Date(Date.now() - 6 * 60_000).toISOString();
    getOrderById(second.id)!.paidAt = new Date(Date.now() - 2 * 60_000).toISOString();

    let demand = getWokDemand();
    expect(demand.batches.chicken).toMatchObject({
      totalPortions: 5,
      queuedPortions: 5,
      cookingPortions: 0,
      nextBatchSize: 4,
      oldestWaitingMinutes: 6,
    });
    expect(demand.nextVariant).toBe('chicken');

    const batch = startWokBatch('chicken');
    expect(batch.portions).toBe(4);
    expect(batch.codes).toEqual([first.zueriCode.formatted, second.zueriCode.formatted]);

    // First order: both chicken boxes cooking, the vegan box still waits
    const a = getOrderById(first.id)!;
    expect(a.status).toBe('in_wok');
    expect(a.portions.map((p) => Boolean(p.firedAt))).toEqual([true, true, false]);
    // Second order: two of three chicken boxes made it into this wok load
    expect(getOrderById(second.id)!.portions.filter((p) => p.firedAt).length).toBe(2);

    demand = getWokDemand();
    expect(demand.batches.chicken).toMatchObject({ queuedPortions: 1, cookingPortions: 4, nextBatchSize: 1 });
    // Total open portions (and with it the wait estimate) do not drop until boxes are plated
    expect(demand.totalActivePortions).toBe(6);
    // The vegan box of the older order is now the oldest waiting portion
    expect(demand.nextVariant).toBe('vegan');

    expect(startWokBatch('chicken').portions).toBe(1);
    expect(startWokBatch('chicken').portions).toBe(0);
  });

  it('ignores unpaid orders and rejects unknown variants', async () => {
    await createOrder({ portions: [{ variant: 'pork_mix' }], paymentMethod: 'cash' });
    expect(startWokBatch('pork_mix').portions).toBe(0);
    expect(() => startWokBatch('fish')).toThrow('INVALID_DISH_VARIANT');
    expect(() => startWokBatch(undefined)).toThrow('INVALID_DISH_VARIANT');
  });

  it('is a crew-only route and never leaks wok state to guests', async () => {
    const order = await paidOrder([{ variant: 'vegan' }]);
    const denied = await guest({ method: 'POST', pathname: '/api/wok/batch', body: { variant: 'vegan' } });
    expect(denied.statusCode).toBe(401);

    const ok = await crew({ method: 'POST', pathname: '/api/wok/batch', body: { variant: 'vegan' } });
    expect(ok.statusCode).toBe(200);
    expect((ok.body as any).data.batch.portions).toBe(1);

    const bad = await crew({ method: 'POST', pathname: '/api/wok/batch', body: { variant: 'x' } });
    expect(bad.statusCode).toBe(400);

    const ticket = await guest({ method: 'GET', pathname: `/api/orders/${order.id}` });
    expect((ticket.body as any).data.order.portions[0].firedAt).toBeUndefined();
  });

  it('keeps working without batch taps: the Schöpfer can plate straight from received', async () => {
    const order = await paidOrder([{ variant: 'chicken' }]);
    advanceOrderStatus(order.id, 'plating');
    expect(getWokDemand().totalActivePortions).toBe(0);
  });

  it('estimates the wait from open portions and the wok batch size', async () => {
    expect(getWokDemand().estimatedWaitMinutes).toBe(3);
    await paidOrder(Array.from({ length: 10 }, () => ({ variant: 'chicken' as const })));
    await paidOrder(Array.from({ length: 10 }, () => ({ variant: 'vegan' as const })));
    // 20 portions / 4 per batch * 2.5 min = 12.5 -> 13
    expect(getWokDemand().estimatedWaitMinutes).toBe(13);

    const features = await guest({ method: 'GET', pathname: '/api/features' });
    expect((features.body as any).data.queue).toEqual({ estimatedWaitMinutes: 13, ordersPaused: false });
    const board = await guest({ method: 'GET', pathname: '/api/board' });
    expect((board.body as any).data.queue.estimatedWaitMinutes).toBe(13);
  });
});

describe('Undo for mis-taps', () => {
  beforeEach(reset);

  it('takes back plating, a call and a handover within the undo window', async () => {
    const order = await paidOrder([{ variant: 'chicken' }]);
    startWokBatch('chicken');

    advanceOrderStatus(order.id, 'plating');
    expect(undoLastMove(order.id).status).toBe('in_wok');
    expect(getOrderById(order.id)!.platedAt).toBeUndefined();

    advanceOrderStatus(order.id, 'plating');
    advanceOrderStatus(order.id, 'ready');
    expect(getBoardEntries()[0].phase).toBe('ready');
    expect(undoLastMove(order.id).status).toBe('plating');
    expect(getBoardEntries()[0].phase).toBe('preparing');

    advanceOrderStatus(order.id, 'ready');
    advanceOrderStatus(order.id, 'completed');
    expect(isZueriCodeAllocated(order.zueriCode.plz)).toBe(false);
    expect(undoLastMove(order.id).status).toBe('ready');
    // The order holds its code again
    expect(isZueriCodeAllocated(order.zueriCode.plz)).toBe(true);
  });

  it('refuses a second undo, a late undo and an undo of payments or cancellations', async () => {
    const order = await paidOrder([{ variant: 'vegan' }]);
    // Nothing to undo right after the cashier released it
    expect(() => undoLastMove(order.id)).toThrow('INVALID_UNDO');

    advanceOrderStatus(order.id, 'plating');
    undoLastMove(order.id);
    expect(() => undoLastMove(order.id)).toThrow('INVALID_UNDO');

    advanceOrderStatus(order.id, 'plating');
    expect(() => undoLastMove(order.id, Date.now() + UNDO_WINDOW_MS + 5000)).toThrow('INVALID_UNDO');

    advanceOrderStatus(order.id, 'cancelled');
    expect(() => undoLastMove(order.id)).toThrow('INVALID_UNDO');
    expect(() => undoLastMove('nope')).toThrow('ORDER_NOT_FOUND');
  });

  it('is reachable through the crew API only', async () => {
    const order = await paidOrder([{ variant: 'vegan' }]);
    advanceOrderStatus(order.id, 'plating');
    const denied = await guest({ method: 'PATCH', pathname: `/api/orders/${order.id}`, body: { action: 'undo' } });
    expect(denied.statusCode).toBe(401);
    const ok = await crew({ method: 'PATCH', pathname: `/api/orders/${order.id}`, body: { action: 'undo' } });
    expect(ok.statusCode).toBe(200);
    expect((ok.body as any).data.order.status).toBe('received');
    const again = await crew({ method: 'PATCH', pathname: `/api/orders/${order.id}`, body: { action: 'undo' } });
    expect(again.statusCode).toBe(400);
  });
});

describe('Pausing orders, rate limits and the code pool', () => {
  beforeEach(reset);

  const body = { portions: [{ variant: 'vegan' }], paymentMethod: 'cash' };

  it('stops guest orders while paused, lets the crew through, and survives a restart', async () => {
    const denied = await guest({ method: 'PATCH', pathname: '/api/features', body: { ordersPaused: true } });
    expect(denied.statusCode).toBe(401);
    const bad = await crew({ method: 'PATCH', pathname: '/api/features', body: { ordersPaused: 'yes' } });
    expect(bad.statusCode).toBe(400);

    const paused = await crew({ method: 'PATCH', pathname: '/api/features', body: { ordersPaused: true } });
    expect((paused.body as any).data.features.ordersPaused).toBe(true);

    const asGuest = await guest({ method: 'POST', pathname: '/api/orders', body });
    expect(asGuest.statusCode).toBe(409);
    expect((asGuest.body as any).error.code).toBe('ORDERS_PAUSED');
    expect(getAllOrders().length).toBe(0);

    const asCrew = await crew({ method: 'POST', pathname: '/api/orders', body });
    expect(asCrew.statusCode).toBe(201);

    resetFeatureFlags();
    expect(getFeatureFlags().ordersPaused).toBe(false);
    loadStoreFromDisk();
    expect(getFeatureFlags().ordersPaused).toBe(true);

    await crew({ method: 'PATCH', pathname: '/api/features', body: { ordersPaused: false } });
    expect((await guest({ method: 'POST', pathname: '/api/orders', body })).statusCode).toBe(201);
  });

  it('limits orders per client, but not the crew and not other clients', async () => {
    const { limit } = RATE_LIMITS.orders();
    for (let i = 0; i < limit; i++) {
      const res = await guest({ method: 'POST', pathname: '/api/orders', body, clientKey: '10.0.0.1' });
      expect(res.statusCode).toBe(201);
    }
    const blocked = await guest({ method: 'POST', pathname: '/api/orders', body, clientKey: '10.0.0.1' });
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers!['Retry-After'])).toBeGreaterThan(0);

    const other = await guest({ method: 'POST', pathname: '/api/orders', body, clientKey: '10.0.0.2' });
    expect(other.statusCode).toBe(201);
    const asCrew = await crew({ method: 'POST', pathname: '/api/orders', body, clientKey: '10.0.0.1' });
    expect(asCrew.statusCode).toBe(201);
  });

  it('opens a new window after the old one ran out', () => {
    resetRateLimits();
    const { limit, windowMs } = RATE_LIMITS.newsletter();
    const t0 = 1_000_000;
    for (let i = 0; i < limit; i++) expect(checkRateLimit('newsletter', 'c', t0).allowed).toBe(true);
    expect(checkRateLimit('newsletter', 'c', t0 + 1000).allowed).toBe(false);
    expect(checkRateLimit('newsletter', 'c', t0 + windowMs).allowed).toBe(true);
    pruneRateLimits(t0 + windowMs + 11 * 60 * 1000);
    expect(checkRateLimit('newsletter', 'c', t0 + windowMs + 11 * 60 * 1000).allowed).toBe(true);
  });

  it('has 80 unique four-digit codes for a rush of 40 orders in 15 minutes', () => {
    expect(ZUERI_CODE_POOL.length).toBe(80);
    expect(new Set(ZUERI_CODE_POOL.map((c) => c.plz)).size).toBe(80);
    for (const c of ZUERI_CODE_POOL) {
      expect(c.plz).toMatch(/^8\d{3}$/);
      expect(c.quarter.length).toBeGreaterThan(1);
    }
  });

  it('gives 40 orders in a row 40 distinct codes without overflow suffixes', async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const order = await createOrder({ portions: [{ variant: 'chicken' }], paymentMethod: 'cash' });
      expect(order.zueriCode.plz).toMatch(/^8\d{3}$/);
      codes.add(order.zueriCode.plz);
    }
    expect(codes.size).toBe(40);
  });
});

describe('Declaration at the order: fail closed and snapshot', () => {
  beforeEach(reset);

  it('stores the declaration the guest saw, with version and stop, and shows it on the ticket', async () => {
    const res = await guest({
      method: 'POST',
      pathname: '/api/orders',
      body: { portions: [{ variant: 'pork_mix', addKaiDao: true }], paymentMethod: 'cash' },
    });
    const pub = (res.body as any).data.order;
    expect(pub.declaration.version).toBe(complianceConfig.version);
    expect(pub.declaration.lines.slice(0, 3)).toEqual([
      'Fleischherkunft: Schwein: Schweiz',
      'Fleischherkunft: Rind: Schweiz',
      'Kai Dao: Eier aus Freilandhaltung, Herkunft: Schweiz',
    ]);
    expect(getOrderById(pub.id)!.stopId).toBe('loc_1');

    const ticket = await guest({ method: 'GET', pathname: `/api/orders/${pub.id}` });
    expect((ticket.body as any).data.order.declaration).toEqual(pub.declaration);
  });

  it('refuses an order whose meat origin is not declared for the live stop', async () => {
    const original = structuredClone(complianceConfig.origin);
    try {
      delete complianceConfig.origin.default.poulet;
      const blocked = await guest({
        method: 'POST',
        pathname: '/api/orders',
        body: { portions: [{ variant: 'vegan' }, { variant: 'chicken' }], paymentMethod: 'cash' },
      });
      expect(blocked.statusCode).toBe(422);
      expect((blocked.body as any).error.code).toBe('ORIGIN_NOT_DECLARED');
      expect((blocked.body as any).error.message).toBe(complianceConfig.texts.originMissing);
      expect(getAllOrders().length).toBe(0);

      // Variants without that species stay orderable
      const vegan = await guest({
        method: 'POST',
        pathname: '/api/orders',
        body: { portions: [{ variant: 'vegan' }], paymentMethod: 'cash' },
      });
      expect(vegan.statusCode).toBe(201);

      // The order page disables the card and says why
      const html = renderOrderPageHtml('loc_1');
      expect(html).toMatch(/data-variant="chicken"[^>]*disabled/);
      expect(html).not.toMatch(/data-variant="vegan"[^>]*disabled/);
      expect(html).toContain(complianceConfig.texts.originMissing);

      // A stop override that declares the origin unblocks that stop only
      complianceConfig.origin.byStop.loc_2 = { origin: { poulet: { country: 'AT' } } };
      setLiveTruckLocation('loc_2');
      const atStop = await guest({
        method: 'POST',
        pathname: '/api/orders',
        body: { portions: [{ variant: 'chicken' }], paymentMethod: 'cash' },
      });
      expect(atStop.statusCode).toBe(201);
      expect((atStop.body as any).data.order.declaration.lines[0]).toBe('Fleischherkunft: Poulet: Österreich');
    } finally {
      complianceConfig.origin.default = original.default;
      complianceConfig.origin.byStop = original.byStop;
    }
  });
});

describe('Order page: one screen, no preselection, declaration above the button', () => {
  beforeEach(reset);

  const html = () => renderOrderPageHtml('loc_1');

  it('preselects no variant and starts with a disabled button', () => {
    const page = html();
    expect(page).not.toMatch(/class="variant-btn selected"/);
    expect(page).toContain('let expressVariant = null;');
    expect(page).toMatch(/id="submitOrderBtn" disabled/);
  });

  it('shows the vegan sauce base, the origin on every meat card and the allergen block inline', () => {
    const page = html();
    expect(page).toContain(complianceConfig.texts.sauceBadge.replace('&', '&amp;'));
    expect(page).toContain('Fleischherkunft: Poulet: Schweiz');
    expect(page).toContain('Fleischherkunft: Schwein: Schweiz');
    expect(page).toContain('Fleischherkunft: Rind: Schweiz');
    // Allergens open inline in the checkout bar: a <details> block, no modal
    expect(page).toMatch(/<details class="alg">\s*<summary>Allergene &amp; Zutaten<\/summary>/);
    expect(page).not.toMatch(/modal/i);
    // The declaration block comes before the pay button inside the same bar
    const bar = page.slice(page.indexOf('id="checkoutBar"'));
    expect(bar.indexOf('id="declBlock"')).toBeLessThan(bar.indexOf('id="submitOrderBtn"'));
    for (const label of Object.values(complianceConfig.allergenLabels)) {
      expect(page).toContain(label);
    }
  });

  it('ships a declaration for every cart the page can build, rendered on the server', () => {
    const data = JSON.parse(/const PAGE = (\{.*\});/.exec(html())![1]);
    const carts = data.decl.carts as Record<string, { l: number[]; b: boolean }>;
    const text = (key: string) => carts[key].l.map((i) => data.decl.lines[i].t);

    expect(text('chicken|n|')[0]).toBe('Fleischherkunft: Poulet: Schweiz');
    expect(text('vegan|v|')).toContain(complianceConfig.texts.vegetarianNote);
    expect(text('vegan|n|')).not.toContain(complianceConfig.texts.vegetarianNote);
    expect(text('vegan+chicken+pork_mix|e|thai_iced_tea+coconut_water').slice(0, 3)).toEqual([
      'Fleischherkunft: Poulet: Schweiz',
      'Fleischherkunft: Schwein: Schweiz',
      'Fleischherkunft: Rind: Schweiz',
    ]);
    for (const key of Object.keys(carts)) {
      expect(text(key), key).toContain(complianceConfig.texts.crossContact);
      expect(carts[key].b, key).toBe(false);
    }
    // 4 variant sets with vegan x 3 egg states (minus the impossible one) + 3 sets x 2, times 8 drink sets
    expect(Object.keys(carts).length).toBe((4 * 3 - 1 + 3 * 2) * 8);
  });

  it('loads no fonts or scripts from other hosts', () => {
    expect(html()).not.toMatch(/https?:\/\//);
  });
});

describe('Newsletter double opt-in', () => {
  beforeEach(reset);

  const tokenFrom = (kind: 'confirm' | 'unsubscribe') =>
    new RegExp(`${kind}\\?token=([0-9a-f]{64})`).exec(getOutbox()[0].text)![1];

  it('stores a request as pending, mails a link, and confirms exactly once', async () => {
    const res = await guest({
      method: 'POST',
      pathname: '/api/newsletter',
      body: { email: 'Fan@Zueri.ch', preferredPlz: '8004', preferredQuarter: 'LANGSTRASSE' },
      baseUrl: 'https://holybasil.example',
    });
    expect(res.statusCode).toBe(202);
    // Nothing about the subscriber comes back to the browser
    expect((res.body as any).data).toEqual({ status: 'confirmation_sent' });

    const [sub] = getNewsletterSubscribers();
    expect(sub).toMatchObject({ email: 'fan@zueri.ch', status: 'pending', preferredPlz: '8004' });
    expect(sub.consent).toMatchObject({ textVersion: NEWSLETTER_CONSENT.version, text: NEWSLETTER_CONSENT.text });
    expect(sub.confirmedAt).toBeUndefined();

    const mail = getOutbox()[0];
    expect(mail.to).toBe('fan@zueri.ch');
    expect(mail.text).toContain('https://holybasil.example/newsletter/confirm?token=');
    expect(mail.text).toContain('https://holybasil.example/newsletter/unsubscribe?token=');
    const token = tokenFrom('confirm');
    // Only the hash of the token is stored
    expect(JSON.stringify(sub)).not.toContain(token);

    const wrong = await guest({ method: 'POST', pathname: '/api/newsletter/confirm', body: { token: 'f'.repeat(64) } });
    expect(wrong.statusCode).toBe(400);
    const ok = await guest({ method: 'POST', pathname: '/api/newsletter/confirm', body: { token } });
    expect(ok.statusCode).toBe(200);
    expect(getNewsletterSubscribers()[0]).toMatchObject({ status: 'confirmed' });
    expect(getNewsletterSubscribers()[0].confirmedAt).toBeTruthy();

    // The link works once
    const again = await guest({ method: 'POST', pathname: '/api/newsletter/confirm', body: { token } });
    expect(again.statusCode).toBe(400);
  });

  it('answers the same for new, pending and confirmed addresses and mails confirmed ones nothing', async () => {
    const send = () => guest({ method: 'POST', pathname: '/api/newsletter', body: { email: 'a@b.ch' } });
    const first = await send();
    const second = await send(); // still pending: a fresh link is sent
    expect(getOutbox().length).toBe(2);
    expect(confirmSubscription(tokenFrom('confirm'))).toBe('confirmed');

    const third = await send(); // already confirmed: no mail
    expect(getOutbox().length).toBe(2);
    for (const res of [first, second, third]) {
      expect(res.statusCode).toBe(202);
      expect((res.body as any).data).toEqual({ status: 'confirmation_sent' });
    }
    expect(getNewsletterSubscribers().length).toBe(1);

    const invalid = await guest({ method: 'POST', pathname: '/api/newsletter', body: { email: 'nope' } });
    expect(invalid.statusCode).toBe(400);
  });

  it('expires the link after 48 hours and deletes unconfirmed requests', async () => {
    const t0 = Date.now();
    await requestSubscription({ email: 'late@b.ch' }, 'http://x', t0);
    const token = tokenFrom('confirm');
    expect(confirmSubscription(token, t0 + CONFIRM_TTL_MS + 1000)).toBe('invalid');
    expect(purgeExpiredPendingSubscriptions(t0 + CONFIRM_TTL_MS - 1000)).toBe(0);
    expect(purgeExpiredPendingSubscriptions(t0 + CONFIRM_TTL_MS + 1000)).toBe(1);
    expect(getNewsletterSubscribers().length).toBe(0);
    expect(confirmSubscription(42)).toBe('invalid');
  });

  it('unsubscribes with the link from the mail and deletes the address', async () => {
    await requestSubscription({ email: 'bye@b.ch' }, 'http://x');
    confirmSubscription(tokenFrom('confirm'));
    const token = tokenFrom('unsubscribe');

    const res = await guest({ method: 'POST', pathname: '/api/newsletter/unsubscribe', body: { token } });
    expect(res.statusCode).toBe(200);
    expect(getNewsletterSubscribers().length).toBe(0);
    expect(unsubscribe(token)).toBe(false);
    // Unknown tokens get the same answer
    const unknown = await guest({ method: 'POST', pathname: '/api/newsletter/unsubscribe', body: { token: 'x' } });
    expect(unknown.statusCode).toBe(200);
  });

  it('shows the crew the list without tokens and limits sign-ups per client', async () => {
    await requestSubscription({ email: 'crew@b.ch' }, 'http://x');
    const list = await crew({ method: 'GET', pathname: '/api/newsletter' });
    const row = (list.body as any).data.subscribers[0];
    expect(row).toMatchObject({ email: 'crew@b.ch', status: 'pending' });
    expect(JSON.stringify(row)).not.toMatch(/token/i);

    const { limit } = RATE_LIMITS.newsletter();
    let last = 0;
    for (let i = 0; i <= limit; i++) {
      last = (await guest({ method: 'POST', pathname: '/api/newsletter', body: { email: `n${i}@b.ch` }, clientKey: 'spam' }))
        .statusCode;
    }
    expect(last).toBe(429);
  });

  it('keeps confirmed subscribers across a restart and drops records without consent evidence', async () => {
    await requestSubscription({ email: 'stay@b.ch' }, 'http://x');
    confirmSubscription(tokenFrom('confirm'));
    const dir = process.env.HB_DATA_DIR!;
    const file = path.join(dir, 'subscribers.json');
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    // A record from before the double opt-in: no consent, no tokens
    stored.push({ id: 'sub_old', email: 'old@b.ch', preferredPlz: '8004', preferredQuarter: 'X', createdAt: 'x' });
    fs.writeFileSync(file, JSON.stringify(stored), 'utf8');

    resetOrderStore();
    expect(loadStoreFromDisk().subscribers).toBe(1);
    expect(getNewsletterSubscribers()[0]).toMatchObject({ email: 'stay@b.ch', status: 'confirmed' });
  });
});

describe('Legal placeholders and the order archive', () => {
  beforeEach(reset);

  it('reports the placeholders that are still open', () => {
    expect(getLegalPlaceholders().length).toBeGreaterThan(5);
    const filled = structuredClone(legalConfig);
    const fill = (obj: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') obj[k] = v.replace(/\[[^\]]+\]/g, 'ok');
        else if (v && typeof v === 'object') fill(v as Record<string, unknown>);
      }
    };
    fill(filled as unknown as Record<string, unknown>);
    expect(getLegalPlaceholders(filled)).toEqual([]);
  });

  it('moves finished orders into a monthly archive and keeps active ones', async () => {
    const done = await paidOrder([{ variant: 'vegan' }]);
    advanceOrderStatus(done.id, 'plating');
    advanceOrderStatus(done.id, 'ready');
    advanceOrderStatus(done.id, 'completed');
    const active = await paidOrder([{ variant: 'chicken' }]);

    expect(archiveFinishedOrders(Date.now() + ARCHIVE_AFTER_MS - 60_000)).toBe(0);
    expect(archiveFinishedOrders(Date.now() + ARCHIVE_AFTER_MS + 60_000)).toBe(1);
    expect(getAllOrders().map((o) => o.id)).toEqual([active.id]);

    const month = done.createdAt.slice(0, 7);
    const archive = JSON.parse(
      fs.readFileSync(path.join(process.env.HB_DATA_DIR!, `orders-archive-${month}.json`), 'utf8')
    );
    expect(archive.map((o: any) => o.id)).toContain(done.id);

    const today = await crew({ method: 'GET', pathname: '/api/orders' });
    expect((today.body as any).data.totalOrdersToday).toBe(1);
  });
});
