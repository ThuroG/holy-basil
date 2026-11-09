import { PaymentMethod, PaymentStatus, OrderStatus } from './types.js';
import { getFeatureFlags } from '../config/features.js';
import { recordPaymentAttempt } from './response.js';

export interface PaymentTransactionResult {
  transactionId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  initialOrderStatus: OrderStatus;
  amountChf: number;
  idempotentReplay: boolean;
  latencyMs: number;
  fallbackTriggered: boolean;
  fallbackReason?: string;
}

const idempotencyCache = new Map<string, PaymentTransactionResult>();

/**
 * IMPORTANT: Digital payments ('twint' | 'card') are a SIMULATION. No payment provider is
 * connected and no money moves. They are only reachable when the feature flag `demoPayments`
 * is on (env DEMO_PAYMENTS=1). Before going live, replace `executeGatewayWithTimeout` with a
 * real provider call (e.g. Payrexx, Datatrans, Stripe) plus a server-side webhook confirmation.
 *
 * Flow:
 * - Cash ('cash'): Immediately places the order in `pending_cash` status (waiting for Cashier confirmation).
 * - Digital ('twint' | 'card'):
 *   - Enforces strict timeout (< 800ms) so the overall API stays below 1,000ms.
 *   - Supports idempotency keys to prevent duplicate charges on double taps or mobile retries.
 *   - If an upstream gateway failure or timeout occurs, it NEVER drops the customer's order:
 *     instead it atomically transitions the order to `payment_error_fallback` so the Züri-Code
 *     remains reserved and the Cashier gets an instant alert to clear it manually!
 */
export async function processOrderPayment(params: {
  amountChf: number;
  paymentMethod: PaymentMethod;
  idempotencyKey?: string;
  simulateFailure?: boolean;
  simulatedDelayMs?: number;
}): Promise<PaymentTransactionResult> {
  const startTime = Date.now();
  const { amountChf, paymentMethod, idempotencyKey, simulateFailure, simulatedDelayMs } = params;

  if (amountChf <= 0 || Number.isNaN(amountChf)) {
    throw new Error('INVALID_PAYMENT_AMOUNT');
  }

  if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
    const cached = idempotencyCache.get(idempotencyKey)!;
    return {
      ...cached,
      idempotentReplay: true,
      latencyMs: Math.max(1, Date.now() - startTime),
    };
  }

  const txId = `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // 1. Cash flow: Immediate pending_cash assignment
  if (paymentMethod === 'cash') {
    const result: PaymentTransactionResult = {
      transactionId: txId,
      paymentMethod: 'cash',
      paymentStatus: 'pending_cash',
      initialOrderStatus: 'pending_cash',
      amountChf,
      idempotentReplay: false,
      latencyMs: Math.max(1, Date.now() - startTime),
      fallbackTriggered: false,
    };
    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, result);
    }
    return result;
  }

  // 2. Digital payment flow (TWINT / Card) with strict timeout guard
  const { paymentTimeoutMs } = getFeatureFlags();

  try {
    await executeGatewayWithTimeout(paymentTimeoutMs, simulateFailure, simulatedDelayMs);

    recordPaymentAttempt('success');
    const result: PaymentTransactionResult = {
      transactionId: txId,
      paymentMethod,
      paymentStatus: 'paid',
      initialOrderStatus: 'received',
      amountChf,
      idempotentReplay: false,
      latencyMs: Math.max(1, Date.now() - startTime),
      fallbackTriggered: false,
    };

    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, result);
    }
    return result;
  } catch (err) {
    // Zero-Loss Automatic Fallback: Preserve order & Züri-Code, trigger manual Cashier workflow
    recordPaymentAttempt('fallback');
    const reason = err instanceof Error ? err.message : 'GATEWAY_ERROR';
    const fallbackResult: PaymentTransactionResult = {
      transactionId: txId,
      paymentMethod,
      paymentStatus: 'payment_error_fallback',
      initialOrderStatus: 'payment_error_fallback',
      amountChf,
      idempotentReplay: false,
      latencyMs: Math.max(1, Date.now() - startTime),
      fallbackTriggered: true,
      fallbackReason: reason,
    };

    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, fallbackResult);
    }
    return fallbackResult;
  }
}

async function executeGatewayWithTimeout(
  timeoutMs: number,
  simulateFailure?: boolean,
  simulatedDelayMs = 5
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('PAYMENT_GATEWAY_TIMEOUT'));
    }, timeoutMs);

    setTimeout(() => {
      clearTimeout(timer);
      if (simulateFailure) {
        reject(new Error('UPSTREAM_PAYMENT_PROVIDER_REJECTED'));
      } else {
        resolve();
      }
    }, Math.min(simulatedDelayMs, timeoutMs + 50));
  });
}

export function clearPaymentIdempotencyCache(): void {
  idempotencyCache.clear();
}
