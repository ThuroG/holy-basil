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
  getLiveLocationId,
  setLiveTruckLocation,
  getActiveOrders,
  getBoardEntries,
  toPublicOrder,
  setCustomSpiceLevelsAndPersist,
} from './orderStore.js';
import { loginCrew, logoutCrew, buildCrewCookie, buildClearCrewCookie } from './auth.js';
import {
  createSuccessResponse,
  createCreatedResponse,
  createErrorResponse,
  getSlaMetrics,
  generateCorrelationId,
} from './response.js';
import {
  getFeatureFlags,
  getAvailablePaymentMethods,
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
  /** True when the request carries a valid crew session. Set by the HTTP layer, never by the client. */
  isCrew?: boolean;
  /** Crew session token (for logout). */
  sessionToken?: string;
  /** Identifies the client for login rate limiting (e.g. remote address). */
  clientKey?: string;
  /** True when the request arrived over HTTPS (sets the Secure cookie flag). */
  secure?: boolean;
}

export interface ApiResult {
  statusCode: number;
  body: unknown;
  headers?: Record<string, string>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function handleApiRequest(req: ApiRequestInput): Promise<ApiResult> {
  const startTime = Date.now();
  const correlationId = req.headers?.['x-correlation-id'] || generateCorrelationId('api');
  const method = req.method.toUpperCase();
  const pathname = req.pathname.replace(/\/+$/, '') || '/';
  const isCrew = req.isCrew === true;
  const body: Record<string, unknown> = isPlainObject(req.body) ? req.body : {};

  const crewRequired = (): ApiResult =>
    createErrorResponse(
      401,
      'CREW_LOGIN_REQUIRED',
      'Diese Funktion ist nur für die Crew. Bitte unter /admin anmelden.',
      startTime,
      { correlationId }
    );

  try {
    // 0. Crew session: login, logout, status
    if (pathname === '/api/crew/login' && method === 'POST') {
      const result = loginCrew(body.pin, req.clientKey);
      if (!result.ok) {
        const tooMany = result.reason === 'TOO_MANY_ATTEMPTS';
        return createErrorResponse(
          tooMany ? 429 : 401,
          result.reason,
          tooMany
            ? 'Zu viele Versuche. Bitte in ein paar Minuten erneut probieren.'
            : 'PIN stimmt nicht.',
          startTime,
          { correlationId }
        );
      }
      const res: ApiResult = createSuccessResponse({ crew: true }, startTime, correlationId);
      res.headers = {
        'Set-Cookie': buildCrewCookie(result.token, result.maxAgeSeconds, req.secure === true),
      };
      return res;
    }

    if (pathname === '/api/crew/logout' && method === 'POST') {
      logoutCrew(req.sessionToken);
      const res: ApiResult = createSuccessResponse({ crew: false }, startTime, correlationId);
      res.headers = { 'Set-Cookie': buildClearCrewCookie() };
      return res;
    }

    if (pathname === '/api/crew/session' && method === 'GET') {
      return createSuccessResponse({ crew: isCrew }, startTime, correlationId);
    }

    // 1. GET /api/health (SLA & NFR Monitoring)
    if (pathname === '/api/health' && method === 'GET') {
      if (!isCrew) {
        // Public liveness probe: no metrics, no error log.
        return createSuccessResponse({ status: 'healthy' }, startTime, correlationId);
      }
      const metrics = getSlaMetrics();
      const features = getFeatureFlags();
      return createSuccessResponse(
        {
          status: 'healthy',
          uptimeSlaTarget: '99.5%',
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
            paymentMethods: getAvailablePaymentMethods(),
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
        if (!isCrew) return crewRequired();
        const payload = body as { enableCustomSpiceLevels?: boolean };
        if (typeof payload.enableCustomSpiceLevels !== 'boolean') {
          return createErrorResponse(
            400,
            'INVALID_FEATURE_TOGGLE_PAYLOAD',
            'Feld enableCustomSpiceLevels (boolean) ist erforderlich.',
            startTime,
            { correlationId }
          );
        }
        const updated = setCustomSpiceLevelsAndPersist(payload.enableCustomSpiceLevels);
        return createSuccessResponse({ features: updated }, startTime, correlationId);
      }
    }

    // 3. GET / POST /api/orders
    if (pathname === '/api/orders') {
      if (method === 'GET') {
        if (!isCrew) return crewRequired();
        // Only orders the crew still has to act on. Finished ones stay in the data file.
        const orders = getActiveOrders();
        const wokDemand = getWokDemand();
        return createSuccessResponse(
          {
            orders,
            wokDemand,
            totalOrdersToday: getAllOrders().length,
            demoPayments: getFeatureFlags().demoPayments,
          },
          startTime,
          correlationId
        );
      }

      if (method === 'POST') {
        const payload = { ...body } as unknown as CreateOrderInput;
        const headerIdemp = req.headers?.['idempotency-key'];
        if (headerIdemp && !payload.idempotencyKey) {
          payload.idempotencyKey = headerIdemp;
        }

        const order = await createOrder(payload, { allowSimulatedFailure: isCrew });

        // If payment fallback was triggered, still return 201 Created with explicit fallback warning
        return createCreatedResponse(
          {
            order: isCrew ? order : toPublicOrder(order),
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
        // Guests reach their own ticket through the unguessable order id and see the public view only.
        return createSuccessResponse(
          { order: isCrew ? order : toPublicOrder(order) },
          startTime,
          correlationId
        );
      }

      if (method === 'PATCH' || method === 'POST') {
        if (!isCrew) return crewRequired();
        const payload = body as {
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
      if (!isCrew) return crewRequired();
      return createSuccessResponse({ wokDemand: getWokDemand() }, startTime, correlationId);
    }

    // 5b. GET /api/board (public pickup board: codes and phase only)
    if (pathname === '/api/board' && method === 'GET') {
      return createSuccessResponse({ entries: getBoardEntries() }, startTime, correlationId);
    }

    // 6. GET / POST /api/newsletter
    if (pathname === '/api/newsletter') {
      if (method === 'GET') {
        if (!isCrew) return crewRequired();
        return createSuccessResponse(
          { subscribers: getNewsletterSubscribers() },
          startTime,
          correlationId
        );
      }
      if (method === 'POST') {
        const payload = body as {
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
        if (!isCrew) return crewRequired();
        return createSuccessResponse({ inquiries: getB2BInquiries() }, startTime, correlationId);
      }
      if (method === 'POST') {
        const payload = body as unknown as Parameters<typeof createB2BInquiry>[0];
        const inq = createB2BInquiry(payload);
        return createCreatedResponse({ inquiry: inq }, startTime, correlationId);
      }
    }

    // 8. GET / PATCH /api/locations
    if (pathname === '/api/locations') {
      if (method === 'GET') {
        return createSuccessResponse(
          { locations: getTruckLocations(), liveLocationId: getLiveLocationId() },
          startTime,
          correlationId
        );
      }
      if (method === 'PATCH' || method === 'POST') {
        if (!isCrew) return crewRequired();
        // locationId: id of the live stop, or null when the truck is closed
        const locationId = body.locationId;
        if (locationId !== null && (typeof locationId !== 'string' || !locationId)) {
          return createErrorResponse(
            400,
            'MISSING_LOCATION_ID',
            'locationId ist erforderlich (oder null für «Truck geschlossen»).',
            startTime,
            { correlationId }
          );
        }
        const locations = setLiveTruckLocation(locationId);
        return createSuccessResponse(
          { locations, liveLocationId: getLiveLocationId() },
          startTime,
          correlationId
        );
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

    // Never leak internals to the client; the crew finds the details in the server log.
    console.error(`[holy-basil] ${correlationId}`, err);
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Interner Fehler. Bitte an der Kasse melden.', startTime, {
      correlationId,
      fallbackAction: 'MANUAL_CASH_CONFIRMATION',
      isServerFault: true,
    });
  }
}
