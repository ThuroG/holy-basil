import { describe, it, expect, beforeEach } from 'vitest';
import {
  startCheckout,
  getPaymentProvider,
  buildTestWebhook,
  chfToRappen,
  resetPaymentService,
  WEBHOOK_SIGNATURE_HEADER,
} from '../../src/lib/paymentService.js';
import { resetFeatureFlags, setDemoPaymentsEnabled } from '../../src/config/features.js';
import {
  createSuccessResponse,
  createCreatedResponse,
  createErrorResponse,
  getSlaMetrics,
  resetSlaMetrics,
} from '../../src/lib/response.js';

const checkout = (extra: Record<string, unknown> = {}) => ({
  orderId: 'ord_test',
  amountRappen: 4200,
  currency: 'CHF' as const,
  method: 'twint' as const,
  idempotencyKey: 'key_1',
  returnUrl: '/order/ord_test',
  ...extra,
});

describe('Payment service: provider interface, timeout guard and webhook signature', () => {
  beforeEach(() => {
    resetFeatureFlags();
    setDemoPaymentsEnabled(true);
    resetPaymentService();
    resetSlaMetrics();
  });

  it('has no provider unless demo payments are on', async () => {
    setDemoPaymentsEnabled(false);
    expect(getPaymentProvider()).toBeNull();
    const res = await startCheckout(checkout());
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe('NO_PAYMENT_PROVIDER');
  });

  it('opens a checkout with a redirect URL well inside the 1000ms SLA', async () => {
    const res = await startCheckout(checkout());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.provider).toBe('test');
    expect(res.session.redirectUrl).toBe(`/pay/test/${res.session.providerRef}`);
    expect(Date.parse(res.session.expiresAt)).toBeGreaterThan(Date.now());
    expect(res.latencyMs).toBeLessThan(1000);
  });

  it('turns a provider rejection into a result instead of an exception', async () => {
    const res = await startCheckout(checkout({ simulateFailure: true }));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe('UPSTREAM_PAYMENT_PROVIDER_REJECTED');
  });

  it('rejects zero, negative and fractional Rappen amounts', async () => {
    for (const amountRappen of [0, -100, 12.5]) {
      await expect(startCheckout(checkout({ amountRappen }))).rejects.toThrow('INVALID_PAYMENT_AMOUNT');
    }
    expect(chfToRappen(17.5)).toBe(1750);
    expect(chfToRappen(0.1 + 0.2)).toBe(30);
  });

  it('accepts a correctly signed webhook and rejects tampered, unsigned and stale ones', () => {
    const provider = getPaymentProvider()!;
    const event = {
      type: 'payment.succeeded' as const,
      providerRef: 'test_abc',
      orderId: 'ord_1',
      amountRappen: 1500,
      currency: 'CHF',
    };
    const signed = buildTestWebhook(event);
    expect(provider.verifyWebhook(signed.rawBody, signed.headers)).toMatchObject(event);

    // Body changed after signing (e.g. a lower amount)
    const tampered = signed.rawBody.replace('1500', '1');
    expect(() => provider.verifyWebhook(tampered, signed.headers)).toThrow('WEBHOOK_SIGNATURE_INVALID');

    // No or malformed signature header
    expect(() => provider.verifyWebhook(signed.rawBody, {})).toThrow('WEBHOOK_SIGNATURE_INVALID');
    expect(() =>
      provider.verifyWebhook(signed.rawBody, { [WEBHOOK_SIGNATURE_HEADER]: 't=abc,v1=zz' })
    ).toThrow('WEBHOOK_SIGNATURE_INVALID');

    // Valid signature, but replayed ten minutes later
    expect(() =>
      provider.verifyWebhook(signed.rawBody, signed.headers, Date.now() + 10 * 60 * 1000)
    ).toThrow('WEBHOOK_SIGNATURE_INVALID');

    // Signed with another secret (after a restart without PAYMENT_WEBHOOK_SECRET)
    resetPaymentService();
    expect(() => provider.verifyWebhook(signed.rawBody, signed.headers)).toThrow(
      'WEBHOOK_SIGNATURE_INVALID'
    );
  });

  it('rejects a signed webhook whose payload is not a payment event', () => {
    const provider = getPaymentProvider()!;
    for (const bad of [
      { type: 'payment.hacked', providerRef: 'a', orderId: 'b', amountRappen: 1, currency: 'CHF' },
      { type: 'payment.succeeded', providerRef: 'a', orderId: 'b', amountRappen: 1.5, currency: 'CHF' },
    ]) {
      const signed = buildTestWebhook(bad as any);
      expect(() => provider.verifyWebhook(signed.rawBody, signed.headers)).toThrow(
        'WEBHOOK_PAYLOAD_INVALID'
      );
    }
  });
});

describe('Standardized API Response & SLA Metrics', () => {
  beforeEach(() => {
    resetSlaMetrics();
  });

  it('tracks sub-second latency and availability rate accurately', () => {
    const start = Date.now() - 25;
    const ok = createSuccessResponse({ hello: 'zurich' }, start, 'corr_1');
    expect(ok.statusCode).toBe(200);
    expect(ok.body.success).toBe(true);
    expect(ok.body.meta.slaCompliant).toBe(true);

    const created = createCreatedResponse({ id: 1 }, start, 'corr_2');
    expect(created.statusCode).toBe(201);

    // 400 client error does not degrade system availability SLA
    const badReq = createErrorResponse(400, 'BAD_INPUT', 'Ungültige Eingabe', start);
    expect(badReq.statusCode).toBe(400);
    expect(badReq.body.success).toBe(false);

    const metrics = getSlaMetrics();
    expect(metrics.totalRequests).toBe(3);
    expect(metrics.availabilityRate).toBe(100);
    expect(metrics.subSecondComplianceRate).toBe(100);
    expect(metrics.recentErrors.length).toBe(1);
  });
});
