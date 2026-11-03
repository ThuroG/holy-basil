import {
  createOrder,
  getAllOrders,
  getOrderById,
  advanceOrderStatus,
  confirmOrderPaymentAtCashier,
  getWokDemand,
  subscribeNewsletter,
  getNewsletterSubscribers,
  createB2BInquiry,
  getB2BInquiries,
  getTruckLocations,
  setLiveTruckLocation,
} from './orderStore.js';
import {
  createSuccessResponse,
  createCreatedResponse,
  createErrorResponse,
  getSlaMetrics,
  generateCorrelationId,
} from './response.js';
import {
  getFeatureFlags,
  setCustomSpiceLevelsEnabled,
  MENU_DISHES,
  MENU_DRINKS,
  KAI_DAO_PRICE_CHF,
  SPICE_LABELS,
} from '../config/features.js';
import { CreateOrderInput, OrderStatus } from './types.js';

export interface ApiRequestInput {
  method: string;
  pathname: string;
  body?: unknown;
  headers?: Record<string, string | undefined>;
}

export async function handleApiRequest(req: ApiRequestInput): Promise<{
  statusCode: number;
  body: unknown;
}> {
  const startTime = Date.now();
  const correlationId = req.headers?.['x-correlation-id'] || generateCorrelationId('api');
  const method = req.method.toUpperCase();
  const pathname = req.pathname.replace(/\/+$/, '') || '/';

  try {
    // 1. GET /api/health (SLA & NFR Monitoring)
    if (pathname === '/api/health' && method === 'GET') {
      const metrics = getSlaMetrics();
      const features = getFeatureFlags();
      return createSuccessResponse(
        {
          status: 'healthy',
          uptimeSlaTarget: '99.5%',
          paymentReliabilityTarget: '99.99%',
          latencyThresholdMs: features.latencyThresholdMs,
          metrics,
          features,
        },
        startTime,
        correlationId
      );
    }

    // 2. GET / PATCH /api/features (Feature Toggle Management)
    if (pathname === '/api/features') {
      if (method === 'GET') {
        return createSuccessResponse(
          {
            features: getFeatureFlags(),
            menu: {
              dishes: MENU_DISHES,
              drinks: MENU_DRINKS,
              kaiDaoPriceChf: KAI_DAO_PRICE_CHF,
              spiceLabels: SPICE_LABELS,
            },
          },
          startTime,
          correlationId
        );
      }
      if (method === 'PATCH' || method === 'POST') {
        const payload = (req.body || {}) as { enableCustomSpiceLevels?: boolean };
        if (typeof payload.enableCustomSpiceLevels !== 'boolean') {
          return createErrorResponse(
            400,
            'INVALID_FEATURE_TOGGLE_PAYLOAD',
            'Feld enableCustomSpiceLevels (boolean) ist erforderlich.',
            startTime,
            { correlationId }
          );
        }
        const updated = setCustomSpiceLevelsEnabled(payload.enableCustomSpiceLevels);
        return createSuccessResponse({ features: updated }, startTime, correlationId);
      }
    }

    // 3. GET / POST /api/orders
    if (pathname === '/api/orders') {
      if (method === 'GET') {
        const orders = getAllOrders();
        const wokDemand = getWokDemand();
        return createSuccessResponse({ orders, wokDemand }, startTime, correlationId);
      }

      if (method === 'POST') {
        const payload = (req.body || {}) as CreateOrderInput;
        const headerIdemp = req.headers?.['idempotency-key'];
        if (headerIdemp && !payload.idempotencyKey) {
          payload.idempotencyKey = headerIdemp;
        }

        const order = await createOrder(payload);

        // If payment fallback was triggered, still return 201 Created with explicit fallback warning
        return createCreatedResponse(
          {
            order,
            fallbackWarning:
              order.status === 'payment_error_fallback'
                ? 'Digitale Zahlung konnte nicht verifiziert werden. Dein Züri-Code ist reserviert – bitte an der Foodtruck-Kasse bezahlen.'
                : undefined,
          },
          startTime,
          correlationId
        );
      }
    }

    // 4. GET / PATCH /api/orders/:id
    if (pathname.startsWith('/api/orders/')) {
      const orderId = pathname.replace('/api/orders/', '').trim();

      if (method === 'GET') {
        const order = getOrderById(orderId);
        if (!order) {
          return createErrorResponse(
            404,
            'ORDER_NOT_FOUND',
            `Bestellung ${orderId} wurde nicht gefunden.`,
            startTime,
            { correlationId }
          );
        }
        return createSuccessResponse({ order }, startTime, correlationId);
      }

      if (method === 'PATCH' || method === 'POST') {
        const payload = (req.body || {}) as {
          action?: 'confirm_cash' | 'advance_status';
          status?: OrderStatus;
          note?: string;
        };

        if (payload.action === 'confirm_cash') {
          const updated = confirmOrderPaymentAtCashier(orderId, payload.note);
          return createSuccessResponse(
            { order: updated, wokDemand: getWokDemand() },
            startTime,
            correlationId
          );
        }

        if (!payload.status) {
          return createErrorResponse(
            400,
            'MISSING_TARGET_STATUS',
            'Ziel-Status (status) muss angegeben werden.',
            startTime,
            { correlationId }
          );
        }

        const updated = advanceOrderStatus(orderId, payload.status, payload.note);
        return createSuccessResponse(
          { order: updated, wokDemand: getWokDemand() },
          startTime,
          correlationId
        );
      }
    }

    // 5. GET /api/wok-demand (Dedicated Zero-Click Cook Endpoint)
    if (pathname === '/api/wok-demand' && method === 'GET') {
      return createSuccessResponse({ wokDemand: getWokDemand() }, startTime, correlationId);
    }

    // 6. GET / POST /api/newsletter
    if (pathname === '/api/newsletter') {
      if (method === 'GET') {
        return createSuccessResponse(
          { subscribers: getNewsletterSubscribers() },
          startTime,
          correlationId
        );
      }
      if (method === 'POST') {
        const payload = (req.body || {}) as {
          email?: string;
          preferredPlz?: string;
          preferredQuarter?: string;
        };
        const sub = subscribeNewsletter({
          email: payload.email || '',
          preferredPlz: payload.preferredPlz,
          preferredQuarter: payload.preferredQuarter,
        });
        return createCreatedResponse({ subscriber: sub }, startTime, correlationId);
      }
    }

    // 7. GET / POST /api/b2b
    if (pathname === '/api/b2b') {
      if (method === 'GET') {
        return createSuccessResponse({ inquiries: getB2BInquiries() }, startTime, correlationId);
      }
      if (method === 'POST') {
        const payload = (req.body || {}) as Parameters<typeof createB2BInquiry>[0];
        const inq = createB2BInquiry(payload);
        return createCreatedResponse({ inquiry: inq }, startTime, correlationId);
      }
    }

    // 8. GET / PATCH /api/locations
    if (pathname === '/api/locations') {
      if (method === 'GET') {
        return createSuccessResponse({ locations: getTruckLocations() }, startTime, correlationId);
      }
      if (method === 'PATCH' || method === 'POST') {
        const payload = (req.body || {}) as { locationId?: string };
        if (!payload.locationId) {
          return createErrorResponse(
            400,
            'MISSING_LOCATION_ID',
            'locationId ist erforderlich.',
            startTime,
            { correlationId }
          );
        }
        const locations = setLiveTruckLocation(payload.locationId);
        return createSuccessResponse({ locations }, startTime, correlationId);
      }
    }

    return createErrorResponse(
      404,
      'ENDPOINT_NOT_FOUND',
      `Route ${method} ${pathname} existiert nicht.`,
      startTime,
      { correlationId }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'INTERNAL_SERVER_ERROR';

    if (message.startsWith('MIN_PORTIONS_REQUIRED') || message.startsWith('MAX_PORTIONS_EXCEEDED')) {
      return createErrorResponse(422, 'INVALID_PORTION_COUNT', message, startTime, {
        correlationId,
        fallbackAction: 'RETRY_REQUEST',
      });
    }

    if (
      message.startsWith('INVALID_') ||
      message.startsWith('UNPAID_ORDER_CANNOT_ADVANCE_IN_KITCHEN')
    ) {
      return createErrorResponse(400, 'VALIDATION_ERROR', message, startTime, {
        correlationId,
        fallbackAction: 'CONTACT_CREW',
      });
    }

    if (message === 'ORDER_NOT_FOUND' || message === 'LOCATION_NOT_FOUND') {
      return createErrorResponse(404, message, 'Eintrag wurde nicht gefunden.', startTime, {
        correlationId,
      });
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', message, startTime, {
      correlationId,
      fallbackAction: 'MANUAL_CASH_CONFIRMATION',
      isServerFault: true,
    });
  }
}
