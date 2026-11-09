import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createAppServer } from '../../src/server.js';
import { resetOrderStore } from '../../src/lib/orderStore.js';
import { resetFeatureFlags } from '../../src/config/features.js';
import { resetAuth } from '../../src/lib/auth.js';

let server: http.Server;
let base = '';

beforeAll(async () => {
  server = createAppServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  resetFeatureFlags();
  resetOrderStore();
  resetAuth('424242');
});

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('HTTP server', () => {
  it('serves the guest pages without crew links', async () => {
    for (const route of ['/', '/order', '/order/ord_abc', '/board']) {
      const res = await fetch(base + route);
      expect(res.status, route).toBe(200);
      const html = await res.text();
      expect(html, route).not.toContain('href="/admin"');
      expect(html, route).not.toContain('/api/health');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    }
  });

  it('shows the PIN screen on /admin until the crew logs in', async () => {
    const before = await (await fetch(base + '/admin')).text();
    expect(before).toContain('Crew Login');
    expect(before).not.toContain('WOK DEMAND');

    const denied = await fetch(base + '/api/orders');
    expect(denied.status).toBe(401);

    const wrong = await fetch(base + '/api/crew/login', json({ pin: '111111' }));
    expect(wrong.status).toBe(401);

    const login = await fetch(base + '/api/crew/login', json({ pin: '424242' }));
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];

    const admin = await (await fetch(base + '/admin', { headers: { Cookie: cookie } })).text();
    expect(admin).toContain('WOK DEMAND');

    const orders = await fetch(base + '/api/orders', { headers: { Cookie: cookie } });
    expect(orders.status).toBe(200);

    // A made-up cookie is worth nothing
    const forged = await fetch(base + '/api/orders', { headers: { Cookie: 'hb_crew=deadbeef' } });
    expect(forged.status).toBe(401);
  });

  it('takes a guest order end to end over HTTP', async () => {
    const res = await fetch(base + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'http-1' },
      body: JSON.stringify({ portions: [{ variant: 'chicken', addKaiDao: true }], paymentMethod: 'cash' }),
    });
    expect(res.status).toBe(201);
    const order = (await res.json()).data.order;
    expect(order.totalChf).toBe(17.5);
    expect(order.status).toBe('pending_cash');

    const ticket = await fetch(`${base}/api/orders/${order.id}`);
    expect((await ticket.json()).data.order.id).toBe(order.id);

    const selfApprove = await fetch(`${base}/api/orders/${order.id}`, {
      ...json({ action: 'confirm_cash' }),
      method: 'PATCH',
    });
    expect(selfApprove.status).toBe(401);
  });

  it('rejects broken, oversized and non-JSON bodies', async () => {
    const broken = await fetch(base + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    });
    expect(broken.status).toBe(400);
    expect((await broken.json()).error.code).toBe('INVALID_JSON_BODY');

    const form = await fetch(base + '/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=a@b.ch',
    });
    expect(form.status).toBe(415);

    const huge = await fetch(base + '/api/orders', json({ customerNote: 'x'.repeat(64 * 1024) })).catch(
      () => null
    );
    if (huge) expect(huge.status).toBe(413);
  });

  it('serves assets and a real QR code, and nothing outside the asset folder', async () => {
    const logo = await fetch(base + '/assets/holy_basil_logo_v7_team_stacked_sticker.svg');
    expect(logo.status).toBe(200);
    expect(logo.headers.get('cache-control')).toContain('max-age');

    const qr = await fetch(base + '/qr.svg');
    expect(qr.status).toBe(200);
    expect(await qr.text()).toContain('<svg');

    expect((await fetch(base + '/assets/..%2Fpackage.json')).status).toBe(404);
    expect((await fetch(base + '/assets/%E0%A4%A')).status).toBe(404);
    expect((await fetch(base + '/nope')).status).toBe(404);
    expect((await fetch(base + '/order', { method: 'DELETE' })).status).toBe(405);
  });
});
