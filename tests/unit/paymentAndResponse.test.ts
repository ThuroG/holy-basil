import { describe, it, expect, beforeEach } from 'vitest';
import {
  processOrderPayment,
  clearPaymentIdempotencyCache,
} from '../../src/lib/paymentService.js';
import {
  createSuccessResponse,
  createCreatedResponse,
  createErrorResponse,
  getSlaMetrics,
  resetSlaMetrics,
} from '../../src/lib/response.js';

describe('Payment Service (99.99% Reliability & Idempotency)', () => {
  beforeEach(() => {
    clearPaymentIdempotencyCache();
    resetSlaMetrics();
  });

  it('places cash payments immediately into pending_cash status', async () => {
    const res = await processOrderPayment({
      amountChf: 28.5,
      paymentMethod: 'cash',
      idempotencyKey: 'cash_key_1',
    });

    expect(res.paymentStatus).toBe('pending_cash');
    expect(res.initialOrderStatus).toBe('pending_cash');
    expect(res.fallbackTriggered).toBe(false);
    expect(res.idempotentReplay).toBe(false);

    // Replay with same idempotency key
    const replay = await processOrderPayment({
      amountChf: 28.5,
      paymentMethod: 'cash',
      idempotencyKey: 'cash_key_1',
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.transactionId).toBe(res.transactionId);
  });

  it('processes digital payments (TWINT / Card) under 1000ms SLA', async () => {
    const res = await processOrderPayment({
      amountChf: 42.0,
      paymentMethod: 'twint',
      idempotencyKey: 'twint_key_1',
    });

    expect(res.paymentStatus).toBe('paid');
    expect(res.initialOrderStatus).toBe('received');
    expect(res.latencyMs).toBeLessThan(1000);
    expect(res.fallbackTriggered).toBe(false);
  });

  it('triggers zero-loss PAYMENT_ERROR_FALLBACK when upstream gateway fails or times out', async () => {
    const failed = await processOrderPayment({
      amountChf: 15.0,
      paymentMethod: 'card',
      simulateFailure: true,
    });

    expect(failed.paymentStatus).toBe('payment_error_fallback');
    expect(failed.initialOrderStatus).toBe('payment_error_fallback');
    expect(failed.fallbackTriggered).toBe(true);
    expect(failed.fallbackReason).toBe('UPSTREAM_PAYMENT_PROVIDER_REJECTED');

    const metrics = getSlaMetrics();
    expect(metrics.paymentFallbacksTriggered).toBe(1);
    expect(metrics.paymentReliabilityRate).toBe(100);
  });

  it('rejects invalid zero or negative payment amounts', async () => {
    await expect(
      processOrderPayment({
        amountChf: 0,
        paymentMethod: 'twint',
      })
    ).rejects.toThrow('INVALID_PAYMENT_AMOUNT');
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
