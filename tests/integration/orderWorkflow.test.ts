import { describe, it, expect, beforeEach } from 'vitest';
import { handleApiRequest } from '../../src/lib/apiHandler.js';
import { resetOrderStore, calculateOrderTotal } from '../../src/lib/orderStore.js';
import { resetFeatureFlags } from '../../src/config/features.js';
import { resetSlaMetrics } from '../../src/lib/response.js';
import { processOrderPayment } from '../../src/lib/paymentService.js';

describe('Full End-to-End Integration: API, 1-10 Portions, 4-Station Workflow & NFRs', () => {
  beforeEach(() => {
    resetFeatureFlags();
    resetOrderStore();
    resetSlaMetrics();
  });

  it('completes full 4-station lifecycle for a 10-portion group order under 1000ms SLA', async () => {
    const portions = Array.from({ length: 10 }, (_, idx) => ({
      variant: (idx % 2 === 0 ? 'chicken' : 'vegan') as 'chicken' | 'vegan',
      addKaiDao: idx < 4,
    }));

    const createRes = await handleApiRequest({
      method: 'POST',
      pathname: '/api/orders',
      headers: { 'idempotency-key': 'group_order_10' },
      body: {
        portions,
        drinks: [
          { drinkId: 'thai_iced_tea', quantity: 3 },
          { drinkId: 'coconut_water', quantity: 2 },
        ],
        paymentMethod: 'cash',
        preferredPlz: '8004',
        customerNote: 'Team Lunch 10 Personen',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createdBody = createRes.body as any;
    expect(createdBody.success).toBe(true);
    expect(createdBody.meta.latencyMs).toBeLessThan(1000);

    const order = createdBody.data.order;
    expect(order.totalPortions).toBe(10);
    expect(order.zueriCode.plz).toBe('8004');
    expect(order.status).toBe('pending_cash');
    expect(order.totalChf).toBe(161.5);

    // Idempotent replay of the exact same order returns the existing order
    const replayRes = await handleApiRequest({
      method: 'POST',
      pathname: '/api/orders',
      headers: { 'idempotency-key': 'group_order_10' },
      body: {
        portions,
        paymentMethod: 'cash',
      },
    });
    expect(replayRes.statusCode).toBe(201);
    expect((replayRes.body as any).data.order.id).toBe(order.id);

    // List all orders & single order
    const listOrdersRes = await handleApiRequest({ method: 'GET', pathname: '/api/orders' });
    expect(listOrdersRes.statusCode).toBe(200);
    expect((listOrdersRes.body as any).data.orders.length).toBe(1);

    const getOrderRes = await handleApiRequest({
      method: 'GET',
      pathname: `/api/orders/${order.id}`,
    });
    expect(getOrderRes.statusCode).toBe(200);
    expect((getOrderRes.body as any).data.order.id).toBe(order.id);

    // Try advancing an unpaid cash order directly to plating -> should fail with 400
    const illegalAdvance = await handleApiRequest({
      method: 'PATCH',
      pathname: `/api/orders/${order.id}`,
      body: { status: 'plating' },
    });
    expect(illegalAdvance.statusCode).toBe(400);

    // Station 1 (Cashier): Confirm Cash Payment
    const cashConfirmRes = await handleApiRequest({
      method: 'PATCH',
      pathname: `/api/orders/${order.id}`,
      body: {
        action: 'confirm_cash',
        note: 'CHF 161.50 bar erhalten',
      },
    });
    expect(cashConfirmRes.statusCode).toBe(200);
    const afterCash = (cashConfirmRes.body as any).data;
    expect(afterCash.order.status).toBe('received');
    expect(afterCash.order.paymentStatus).toBe('paid');
    expect(afterCash.wokDemand.totalActivePortions).toBe(10);
    expect(afterCash.wokDemand.totalKaiDaoEggs).toBe(4);

    // Dedicated Wok Demand endpoint
    const wokRes = await handleApiRequest({ method: 'GET', pathname: '/api/wok-demand' });
    expect(wokRes.statusCode).toBe(200);
    expect((wokRes.body as any).data.wokDemand.totalActivePortions).toBe(10);

    // Station 3 (Schöpfer / Assembly): Mark order plated
    const plateRes = await handleApiRequest({
      method: 'PATCH',
      pathname: `/api/orders/${order.id}`,
      body: { status: 'plating' },
    });
    expect(plateRes.statusCode).toBe(200);
    expect((plateRes.body as any).data.order.status).toBe('plating');
    expect((plateRes.body as any).data.wokDemand.totalActivePortions).toBe(0);

    // Station 4 (QC & Drinks): Verify boxes + 5 drinks and call out READY
    const readyRes = await handleApiRequest({
      method: 'PATCH',
      pathname: `/api/orders/${order.id}`,
      body: { status: 'ready', note: 'QC & 5 Drinks bereitgestellt' },
    });
    expect(readyRes.statusCode).toBe(200);
    expect((readyRes.body as any).data.order.status).toBe('ready');

    // Handout: Complete order and release Züri-Code 8004
    const completeRes = await handleApiRequest({
      method: 'PATCH',
      pathname: `/api/orders/${order.id}`,
      body: { status: 'completed' },
    });
    expect(completeRes.statusCode).toBe(200);
    expect((completeRes.body as any).data.order.status).toBe('completed');
  });

  it('validates edge cases, error codes (400, 404, 422), and timeout fallback', async () => {
    const zeroRes = await handleApiRequest({
      method: 'POST',
      pathname: '/api/orders',
      body: { portions: [], paymentMethod: 'twint' },
    });
    expect(zeroRes.statusCode).toBe(422);

    const elevenPortions = Array.from({ length: 11 }, () => ({ variant: 'vegan' }));
    const elevenRes = await handleApiRequest({
      method: 'POST',
      pathname: '/api/orders',
      body: { portions: elevenPortions, paymentMethod: 'twint' },
    });
    expect(elevenRes.statusCode).toBe(422);

    const invalidPayment = await handleApiRequest({
      method: 'POST',
      pathname: '/api/orders',
      body: { portions: [{ variant: 'vegan' }], paymentMethod: 'crypto' as any },
    });
    expect(invalidPayment.statusCode).toBe(400);

    const invalidVariant = await handleApiRequest({
      method: 'POST',
      pathname: '/api/orders',
      body: { portions: [{ variant: 'fish' as any }], paymentMethod: 'twint' },
    });
    expect(invalidVariant.statusCode).toBe(400);

    const invalidDrink = await handleApiRequest({
      method: 'POST',
      pathname: '/api/orders',
      body: {
        portions: [{ variant: 'vegan' }],
        drinks: [{ drinkId: 'beer' as any, quantity: 1 }],
        paymentMethod: 'twint',
      },
    });
    expect(invalidDrink.statusCode).toBe(400);

    const missingOrder = await handleApiRequest({
      method: 'GET',
      pathname: '/api/orders/non_existent',
    });
    expect(missingOrder.statusCode).toBe(404);

    const missingPatchStatus = await handleApiRequest({
      method: 'PATCH',
      pathname: '/api/orders/non_existent',
      body: {},
    });
    expect(missingPatchStatus.statusCode).toBe(400);

    const unknownEndpoint = await handleApiRequest({
      method: 'GET',
      pathname: '/api/does-not-exist',
    });
    expect(unknownEndpoint.statusCode).toBe(404);

    // Test calculateOrderTotal validation errors
    expect(() => calculateOrderTotal([{ variant: 'unknown' as any }])).toThrow('INVALID_DISH_VARIANT');
    expect(() =>
      calculateOrderTotal([{ variant: 'vegan' }], [{ drinkId: 'unknown' as any, quantity: 1 }])
    ).toThrow('INVALID_DRINK_ID');

    // Test payment gateway timeout fallback
    const timeoutPayment = await processOrderPayment({
      amountChf: 14,
      paymentMethod: 'twint',
      simulatedDelayMs: 900,
    });
    expect(timeoutPayment.fallbackTriggered).toBe(true);
    expect(timeoutPayment.fallbackReason).toBe('PAYMENT_GATEWAY_TIMEOUT');
  });

  it('handles simulated payment gateway failure with automatic fallback and manual Cashier resolution', async () => {
    const fallbackOrderRes = await handleApiRequest({
      method: 'POST',
      pathname: '/api/orders',
      body: {
        portions: [{ variant: 'pork_mix', addKaiDao: true }],
        paymentMethod: 'card',
        simulatePaymentFailure: true,
      },
    });

    expect(fallbackOrderRes.statusCode).toBe(201);
    const body = fallbackOrderRes.body as any;
    expect(body.data.order.status).toBe('payment_error_fallback');
    expect(body.data.fallbackWarning).toContain('Foodtruck-Kasse');

    // Cashier manually resolves the payment error via status='received'
    const resolveRes = await handleApiRequest({
      method: 'PATCH',
      pathname: `/api/orders/${body.data.order.id}`,
      body: {
        status: 'received',
        note: 'Manuell am Kartenterminal verifiziert',
      },
    });
    expect(resolveRes.statusCode).toBe(200);
    expect((resolveRes.body as any).data.order.status).toBe('received');

    // Confirming cash again on an already paid order should fail with 400
    const duplicateConfirm = await handleApiRequest({
      method: 'PATCH',
      pathname: `/api/orders/${body.data.order.id}`,
      body: { action: 'confirm_cash' },
    });
    expect(duplicateConfirm.statusCode).toBe(400);
  });

  it('handles newsletter subscriptions, B2B inquiries, location updates, feature toggles, and health check', async () => {
    // Newsletter valid + duplicate update + invalid
    const subRes = await handleApiRequest({
      method: 'POST',
      pathname: '/api/newsletter',
      body: {
        email: 'fan@zueri.ch',
        preferredPlz: '8004',
        preferredQuarter: 'LANGSTRASSE',
      },
    });
    expect(subRes.statusCode).toBe(201);

    const subUpdateRes = await handleApiRequest({
      method: 'POST',
      pathname: '/api/newsletter',
      body: {
        email: 'fan@zueri.ch',
        preferredPlz: '8050',
        preferredQuarter: 'OERLIKON',
      },
    });
    expect(subUpdateRes.statusCode).toBe(201);
    expect((subUpdateRes.body as any).data.subscriber.preferredPlz).toBe('8050');

    const badSubRes = await handleApiRequest({
      method: 'POST',
      pathname: '/api/newsletter',
      body: { email: 'invalid-email' },
    });
    expect(badSubRes.statusCode).toBe(400);

    const listSubRes = await handleApiRequest({
      method: 'GET',
      pathname: '/api/newsletter',
    });
    expect((listSubRes.body as any).data.subscribers.length).toBe(1);

    // B2B Inquiry valid + invalid + list
    const b2bRes = await handleApiRequest({
      method: 'POST',
      pathname: '/api/b2b',
      body: {
        companyName: 'Züri Tech AG',
        contactName: 'Alex Meier',
        email: 'alex@zueritech.ch',
        eventType: 'catering',
        guestCount: 65,
      },
    });
    expect(b2bRes.statusCode).toBe(201);

    const badB2bRes = await handleApiRequest({
      method: 'POST',
      pathname: '/api/b2b',
      body: { companyName: '', email: 'bad' },
    });
    expect(badB2bRes.statusCode).toBe(400);

    const getB2bRes = await handleApiRequest({ method: 'GET', pathname: '/api/b2b' });
    expect(getB2bRes.statusCode).toBe(200);
    expect((getB2bRes.body as any).data.inquiries.length).toBe(1);

    // Locations GET, PATCH valid, PATCH missing, PATCH not found
    const getLocRes = await handleApiRequest({ method: 'GET', pathname: '/api/locations' });
    expect(getLocRes.statusCode).toBe(200);

    const locRes = await handleApiRequest({
      method: 'PATCH',
      pathname: '/api/locations',
      body: { locationId: 'loc_2' },
    });
    expect(locRes.statusCode).toBe(200);

    const missingLocId = await handleApiRequest({
      method: 'PATCH',
      pathname: '/api/locations',
      body: {},
    });
    expect(missingLocId.statusCode).toBe(400);

    const notFoundLoc = await handleApiRequest({
      method: 'PATCH',
      pathname: '/api/locations',
      body: { locationId: 'loc_999' },
    });
    expect(notFoundLoc.statusCode).toBe(404);

    // Feature toggle GET, PATCH valid, PATCH invalid
    const getFeatRes = await handleApiRequest({ method: 'GET', pathname: '/api/features' });
    expect(getFeatRes.statusCode).toBe(200);

    const badFeatRes = await handleApiRequest({
      method: 'PATCH',
      pathname: '/api/features',
      body: { enableCustomSpiceLevels: 'yes' },
    });
    expect(badFeatRes.statusCode).toBe(400);

    const featRes = await handleApiRequest({
      method: 'PATCH',
      pathname: '/api/features',
      body: { enableCustomSpiceLevels: true },
    });
    expect(featRes.statusCode).toBe(200);
    expect((featRes.body as any).data.features.enableCustomSpiceLevels).toBe(true);

    // Health & SLA metrics
    const healthRes = await handleApiRequest({
      method: 'GET',
      pathname: '/api/health',
    });
    expect(healthRes.statusCode).toBe(200);
    const healthData = (healthRes.body as any).data;
    expect(healthData.metrics.availabilityRate).toBeGreaterThanOrEqual(99.5);
    expect(healthData.metrics.paymentReliabilityRate).toBeGreaterThanOrEqual(99.99);
  });
});
