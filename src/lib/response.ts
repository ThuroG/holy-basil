import crypto from 'node:crypto';
import { ApiSuccessResponse, ApiErrorResponse, ApiErrorDetail, SlaMetrics } from './types.js';
import { getFeatureFlags } from '../config/features.js';

interface InternalMetricsState {
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  paymentAttempts: number;
  paymentSuccesses: number;
  paymentFallbacksTriggered: number;
  totalLatencyMs: number;
  maxLatencyMs: number;
  subSecondCount: number;
  recentErrors: Array<{
    correlationId: string;
    code: string;
    message: string;
    timestamp: string;
  }>;
}

const metricsState: InternalMetricsState = {
  totalRequests: 0,
  successfulRequests: 0,
  errorRequests: 0,
  paymentAttempts: 0,
  paymentSuccesses: 0,
  paymentFallbacksTriggered: 0,
  totalLatencyMs: 0,
  maxLatencyMs: 0,
  subSecondCount: 0,
  recentErrors: [],
};

export function generateCorrelationId(prefix = 'hb'): string {
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function recordRequestMetric(latencyMs: number, isSuccess: boolean): boolean {
  const { latencyThresholdMs } = getFeatureFlags();
  const safeLatency = Math.max(0, Math.round(latencyMs));
  const slaCompliant = safeLatency <= latencyThresholdMs;

  metricsState.totalRequests += 1;
  if (isSuccess) {
    metricsState.successfulRequests += 1;
  } else {
    metricsState.errorRequests += 1;
  }

  metricsState.totalLatencyMs += safeLatency;
  if (safeLatency > metricsState.maxLatencyMs) {
    metricsState.maxLatencyMs = safeLatency;
  }
  if (slaCompliant) {
    metricsState.subSecondCount += 1;
  }

  return slaCompliant;
}

export function recordPaymentAttempt(outcome: 'success' | 'fallback'): void {
  metricsState.paymentAttempts += 1;
  if (outcome === 'success') {
    metricsState.paymentSuccesses += 1;
  } else {
    metricsState.paymentFallbacksTriggered += 1;
  }
}

export function createSuccessResponse<T>(
  data: T,
  startTimeMs: number,
  correlationId = generateCorrelationId()
): { statusCode: number; body: ApiSuccessResponse<T> } {
  const latencyMs = Math.max(1, Date.now() - startTimeMs);
  const slaCompliant = recordRequestMetric(latencyMs, true);

  return {
    statusCode: 200,
    body: {
      success: true,
      data,
      meta: {
        latencyMs,
        timestamp: new Date().toISOString(),
        correlationId,
        slaCompliant,
      },
    },
  };
}

export function createCreatedResponse<T>(
  data: T,
  startTimeMs: number,
  correlationId = generateCorrelationId()
): { statusCode: number; body: ApiSuccessResponse<T> } {
  const res = createSuccessResponse(data, startTimeMs, correlationId);
  return {
    statusCode: 201,
    body: res.body,
  };
}

export function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  startTimeMs: number,
  options?: {
    correlationId?: string;
    fallbackAction?: ApiErrorDetail['fallbackAction'];
    details?: Record<string, unknown>;
    isServerFault?: boolean;
  }
): { statusCode: number; body: ApiErrorResponse } {
  const correlationId = options?.correlationId || generateCorrelationId('err');
  const latencyMs = Math.max(1, Date.now() - startTimeMs);
  const isServerFault = options?.isServerFault ?? statusCode >= 500;

  // Client validation errors (4xx) do not count against system availability (99.5% SLA),
  // whereas 5xx server faults do.
  const slaCompliant = recordRequestMetric(latencyMs, !isServerFault);

  const timestamp = new Date().toISOString();
  metricsState.recentErrors.unshift({
    correlationId,
    code,
    message,
    timestamp,
  });
  if (metricsState.recentErrors.length > 25) {
    metricsState.recentErrors.pop();
  }

  return {
    statusCode,
    body: {
      success: false,
      error: {
        code,
        message,
        correlationId,
        fallbackAction: options?.fallbackAction || 'NONE',
        details: options?.details,
      },
      meta: {
        latencyMs,
        timestamp,
        correlationId,
        slaCompliant,
      },
    },
  };
}

export function getSlaMetrics(): SlaMetrics {
  const total = metricsState.totalRequests;
  const avgLatencyMs = total > 0 ? Math.round((metricsState.totalLatencyMs / total) * 10) / 10 : 0;
  const subSecondComplianceRate =
    total > 0 ? Math.round((metricsState.subSecondCount / total) * 10000) / 100 : 100;
  const availabilityRate =
    total > 0 ? Math.round((metricsState.successfulRequests / total) * 10000) / 100 : 100;

  // Payment reliability measures zero-loss transactions (direct success + atomic fallback preservation)
  const pAttempts = metricsState.paymentAttempts;
  const pZeroLoss = metricsState.paymentSuccesses + metricsState.paymentFallbacksTriggered;
  const paymentReliabilityRate =
    pAttempts > 0 ? Math.round((pZeroLoss / pAttempts) * 10000) / 100 : 100;

  return {
    totalRequests: total,
    successfulRequests: metricsState.successfulRequests,
    errorRequests: metricsState.errorRequests,
    paymentAttempts: pAttempts,
    paymentSuccesses: metricsState.paymentSuccesses,
    paymentFallbacksTriggered: metricsState.paymentFallbacksTriggered,
    avgLatencyMs,
    maxLatencyMs: metricsState.maxLatencyMs,
    subSecondComplianceRate,
    availabilityRate,
    paymentReliabilityRate,
    recentErrors: [...metricsState.recentErrors],
  };
}

export function resetSlaMetrics(): void {
  metricsState.totalRequests = 0;
  metricsState.successfulRequests = 0;
  metricsState.errorRequests = 0;
  metricsState.paymentAttempts = 0;
  metricsState.paymentSuccesses = 0;
  metricsState.paymentFallbacksTriggered = 0;
  metricsState.totalLatencyMs = 0;
  metricsState.maxLatencyMs = 0;
  metricsState.subSecondCount = 0;
  metricsState.recentErrors = [];
}
