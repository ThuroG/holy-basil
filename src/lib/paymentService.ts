import crypto from 'node:crypto';
import { getFeatureFlags } from '../config/features.js';

/**
 * Digital payments (TWINT / card) behind one provider interface.
 *
 * How a digital payment runs:
 *   1. The order is created and `startCheckout()` opens a checkout at the provider.
 *      The order waits in `pending_payment`, the guest is sent to `redirectUrl`.
 *   2. The provider calls POST /api/webhooks/payment. Only this signed webhook marks an
 *      order as paid: never the browser coming back from the payment page.
 *   3. If the checkout cannot be opened in time (timeout, provider down) or the provider
 *      reports a failure, the order moves to `payment_error_fallback`: the Züri-Code stays
 *      reserved and the cashier settles it by hand.
 *
 * Today only the built-in TEST provider exists (active with DEMO_PAYMENTS=1). No money moves.
 * To go live, implement `PaymentProvider` for the real provider (e.g. Stripe Checkout with
 * TWINT, Payrexx, Datatrans) and return it from `getPaymentProvider()`.
 */

export type DigitalPaymentMethod = 'twint' | 'card';

export interface CheckoutRequest {
  orderId: string;
  /** Amount in Rappen (integer), so no rounding can happen on the way. */
  amountRappen: number;
  currency: 'CHF';
  method: DigitalPaymentMethod;
  /** Same key for retries of the same order: the provider must not open a second charge. */
  idempotencyKey: string;
  /** Where the provider sends the guest afterwards: the ticket page. */
  returnUrl: string;
  /** Test provider only. */
  simulateFailure?: boolean;
  /** Test provider only. */
  simulatedDelayMs?: number;
}

export interface CheckoutSession {
  providerRef: string;
  redirectUrl: string;
  expiresAt: string;
}

export type PaymentEventType = 'payment.succeeded' | 'payment.failed' | 'payment.expired';

export interface PaymentEvent {
  /** Unique per event. The same id may arrive several times (provider retries). */
  id: string;
  type: PaymentEventType;
  providerRef: string;
  orderId: string;
  amountRappen: number;
  currency: string;
}

export interface PaymentProvider {
  name: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /**
   * Checks the signature over the RAW request body and returns the event.
   * Throws `WEBHOOK_SIGNATURE_INVALID` or `WEBHOOK_PAYLOAD_INVALID`.
   */
  verifyWebhook(
    rawBody: string,
    headers: Record<string, string | undefined>,
    now?: number
  ): PaymentEvent;
}

export const CHECKOUT_TTL_MS = 15 * 60 * 1000;
export const WEBHOOK_SIGNATURE_HEADER = 'x-hb-signature';
const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

export function chfToRappen(amountChf: number): number {
  return Math.round(amountChf * 100);
}

// --- Test provider -----------------------------------------------------------------------

let testSecret: string | null = null;

function getTestWebhookSecret(): string {
  if (testSecret === null) {
    const fromEnv = (process.env.PAYMENT_WEBHOOK_SECRET || '').trim();
    testSecret = fromEnv.length >= 16 ? fromEnv : crypto.randomBytes(32).toString('hex');
  }
  return testSecret;
}

function hmac(secret: string, timestamp: number, rawBody: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

/** Signature header in the form `t=<unix ms>,v1=<hex hmac>`. */
export function signTestWebhook(rawBody: string, now: number = Date.now()): string {
  return `t=${now},v1=${hmac(getTestWebhookSecret(), now, rawBody)}`;
}

const PAYMENT_EVENT_TYPES: readonly PaymentEventType[] = [
  'payment.succeeded',
  'payment.failed',
  'payment.expired',
];

function parseEvent(rawBody: string): PaymentEvent {
  let data: unknown;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error('WEBHOOK_PAYLOAD_INVALID');
  }
  const e = data as Partial<PaymentEvent> | null;
  if (
    !e ||
    typeof e !== 'object' ||
    typeof e.id !== 'string' ||
    !e.id ||
    typeof e.providerRef !== 'string' ||
    typeof e.orderId !== 'string' ||
    typeof e.currency !== 'string' ||
    !Number.isInteger(e.amountRappen) ||
    !PAYMENT_EVENT_TYPES.includes(e.type as PaymentEventType)
  ) {
    throw new Error('WEBHOOK_PAYLOAD_INVALID');
  }
  return {
    id: e.id.slice(0, 120),
    type: e.type as PaymentEventType,
    providerRef: e.providerRef,
    orderId: e.orderId,
    amountRappen: e.amountRappen as number,
    currency: e.currency,
  };
}

const testProvider: PaymentProvider = {
  name: 'test',

  async createCheckout(request) {
    const delay = request.simulatedDelayMs ?? 5;
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (request.simulateFailure) {
      throw new Error('UPSTREAM_PAYMENT_PROVIDER_REJECTED');
    }
    const providerRef = `test_${crypto.randomBytes(12).toString('hex')}`;
    return {
      providerRef,
      redirectUrl: `/pay/test/${providerRef}`,
      expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS).toISOString(),
    };
  },

  verifyWebhook(rawBody, headers, now = Date.now()) {
    const header = headers[WEBHOOK_SIGNATURE_HEADER] || '';
    const parts = Object.fromEntries(
      header.split(',').map((part) => {
        const idx = part.indexOf('=');
        return idx < 0 ? [part, ''] : [part.slice(0, idx).trim(), part.slice(idx + 1).trim()];
      })
    );
    const timestamp = Number(parts.t);
    const given = String(parts.v1 || '');
    if (!Number.isFinite(timestamp) || !/^[0-9a-f]{64}$/.test(given)) {
      throw new Error('WEBHOOK_SIGNATURE_INVALID');
    }
    // An old, replayed request is rejected even with a valid signature.
    if (Math.abs(now - timestamp) > WEBHOOK_TOLERANCE_MS) {
      throw new Error('WEBHOOK_SIGNATURE_INVALID');
    }
    const expected = hmac(getTestWebhookSecret(), timestamp, rawBody);
    if (!crypto.timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'))) {
      throw new Error('WEBHOOK_SIGNATURE_INVALID');
    }
    return parseEvent(rawBody);
  },
};

/** The active provider, or null when only cash is accepted. */
export function getPaymentProvider(): PaymentProvider | null {
  return getFeatureFlags().demoPayments ? testProvider : null;
}

/** A signed webhook request as the test provider would send it. */
export function buildTestWebhook(
  event: Omit<PaymentEvent, 'id'> & { id?: string },
  now: number = Date.now()
): { rawBody: string; headers: Record<string, string> } {
  const rawBody = JSON.stringify({
    id: event.id || `evt_${crypto.randomBytes(10).toString('hex')}`,
    type: event.type,
    providerRef: event.providerRef,
    orderId: event.orderId,
    amountRappen: event.amountRappen,
    currency: event.currency,
  });
  return { rawBody, headers: { [WEBHOOK_SIGNATURE_HEADER]: signTestWebhook(rawBody, now) } };
}

// --- Checkout with timeout guard -----------------------------------------------------------

export type StartCheckoutResult =
  | { ok: true; provider: string; session: CheckoutSession; latencyMs: number }
  | { ok: false; reason: string; latencyMs: number };

/**
 * Opens a checkout. Never throws for provider problems: a timeout or a rejection comes
 * back as `ok: false`, and the caller puts the order into `payment_error_fallback`.
 */
export async function startCheckout(request: CheckoutRequest): Promise<StartCheckoutResult> {
  const startTime = Date.now();
  if (!Number.isInteger(request.amountRappen) || request.amountRappen <= 0) {
    throw new Error('INVALID_PAYMENT_AMOUNT');
  }
  const provider = getPaymentProvider();
  if (!provider) {
    return { ok: false, reason: 'NO_PAYMENT_PROVIDER', latencyMs: 1 };
  }

  const { paymentTimeoutMs } = getFeatureFlags();
  let timer: NodeJS.Timeout | undefined;
  try {
    const session = await Promise.race([
      provider.createCheckout(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('PAYMENT_GATEWAY_TIMEOUT')), paymentTimeoutMs);
      }),
    ]);
    return {
      ok: true,
      provider: provider.name,
      session,
      latencyMs: Math.max(1, Date.now() - startTime),
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'GATEWAY_ERROR',
      latencyMs: Math.max(1, Date.now() - startTime),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Test helper. */
export function resetPaymentService(): void {
  testSecret = null;
}
