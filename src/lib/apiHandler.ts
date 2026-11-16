import {
  createOrder,
  getOrderById,
  advanceOrderStatus,
  confirmOrderPaymentAtCashier,
  getWokDemand,
  createB2BInquiry,
  getB2BInquiries,
  getTruckLocations,
  getLiveLocationId,
  getLiveLocationUpdatedAt,
  setLiveTruckLocation,
  getActiveOrders,
  getBoardEntries,
  toPublicOrder,
  setCustomSpiceLevelsAndPersist,
  setHolyGainsAndPersist,
  setOrdersPausedAndPersist,
  getOrdersTodayCount,
  getQueueInfo,
  getOrderByPaymentRef,
  startWokBatch,
  undoLastMove,
  resolveRefund,
  applyPaymentEvent,
} from './orderStore.js';
import {
  requestSubscription,
  confirmSubscription,
  unsubscribe,
  getNewsletterOverview,
} from './newsletter.js';
import { checkRateLimit, RateLimitBucket } from './rateLimit.js';
import { getPaymentProvider, buildTestWebhook, chfToRappen } from './paymentService.js';
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
  HOLY_GAINS_PRICE_CHF,
  NUTRITION_ESTIMATES,
  SPICE_LABELS,
} from '../config/features.js';
import { complianceConfig } from '../config/compliance.js';
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
  /** Unparsed request body. The payment webhook signature is checked against exactly these bytes. */
  rawBody?: string;
  /** Public address of this site, for links in e-mails. */
  baseUrl?: string;
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

  /** Guests are rate limited per client; the crew is not. */
  const limited = (bucket: RateLimitBucket): ApiResult | null => {
    if (isCrew) return null;
    const check = checkRateLimit(bucket, req.clientKey);
    if (check.allowed) return null;
    const res: ApiResult = createErrorResponse(
      429,
      'RATE_LIMITED',
      'Zu viele Anfragen. Bitte kurz warten oder an der Kasse melden.',
      startTime,
      { correlationId, fallbackAction: 'CONTACT_CREW' }
    );
    res.headers = { 'Retry-After': String(check.retryAfterSeconds) };
    return res;
  };

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
            queue: getQueueInfo(),
            menu: {
              dishes: MENU_DISHES,
              drinks: MENU_DRINKS,
              kaiDaoPriceChf: KAI_DAO_PRICE_CHF,
              holyGainsPriceChf: HOLY_GAINS_PRICE_CHF,
              nutritionEstimates: NUTRITION_ESTIMATES,
              spiceLabels: SPICE_LABELS,
            },
          },
          startTime,
          correlationId
        );
      }
      if (method === 'PATCH' || method === 'POST') {
        if (!isCrew) return crewRequired();
        const payload = body as {
          enableCustomSpiceLevels?: unknown;
          enableHolyGains?: unknown;
          ordersPaused?: unknown;
        };
        const hasSpice = typeof payload.enableCustomSpiceLevels === 'boolean';
        const hasHolyGains = typeof payload.enableHolyGains === 'boolean';
        const hasPause = typeof payload.ordersPaused === 'boolean';
        if (
          (!hasSpice && !hasHolyGains && !hasPause) ||
          (payload.enableCustomSpiceLevels !== undefined && !hasSpice) ||
          (payload.enableHolyGains !== undefined && !hasHolyGains) ||
          (payload.ordersPaused !== undefined && !hasPause)
        ) {
          return createErrorResponse(
            400,
            'INVALID_FEATURE_TOGGLE_PAYLOAD',
            'Feld enableCustomSpiceLevels, enableHolyGains oder ordersPaused (boolean) ist erforderlich.',
            startTime,
            { correlationId }
          );
        }
        if (hasSpice) setCustomSpiceLevelsAndPersist(payload.enableCustomSpiceLevels as boolean);
        if (hasHolyGains) setHolyGainsAndPersist(payload.enableHolyGains as boolean);
        if (hasPause) setOrdersPausedAndPersist(payload.ordersPaused as boolean);
        return createSuccessResponse({ features: getFeatureFlags() }, startTime, correlationId);
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
            totalOrdersToday: getOrdersTodayCount(),
            demoPayments: getFeatureFlags().demoPayments,
          },
          startTime,
          correlationId
        );
      }

      if (method === 'POST') {
        const tooMany = limited('orders');
        if (tooMany) return tooMany;
        const payload = { ...body } as unknown as CreateOrderInput;
        const headerIdemp = req.headers?.['idempotency-key'];
        if (headerIdemp && !payload.idempotencyKey) {
          payload.idempotencyKey = headerIdemp;
        }

        const order = await createOrder(payload, { allowSimulatedFailure: isCrew, isCrew });

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
          { order: isCrew ? order : toPublicOrder(order), queue: getQueueInfo() },
          startTime,
          correlationId
        );
      }

      if (method === 'PATCH' || method === 'POST') {
        if (!isCrew) return crewRequired();
        const payload = body as {
          action?: 'confirm_cash' | 'advance_status' | 'undo' | 'refund_done';
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

        if (payload.action === 'undo') {
          const updated = undoLastMove(orderId);
          return createSuccessResponse(
            { order: updated, wokDemand: getWokDemand() },
            startTime,
            correlationId
          );
        }

        if (payload.action === 'refund_done') {
          const updated = resolveRefund(orderId, payload.note);
          return createSuccessResponse({ order: updated }, startTime, correlationId);
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

    // 5a. POST /api/wok/batch (the cook starts one wok batch of a variant)
    if (pathname === '/api/wok/batch' && method === 'POST') {
      if (!isCrew) return crewRequired();
      const batch = startWokBatch(body.variant);
      return createSuccessResponse({ batch, wokDemand: getWokDemand() }, startTime, correlationId);
    }

    // 5b. GET /api/board (public pickup board: codes, phase and queue info only)
    if (pathname === '/api/board' && method === 'GET') {
      return createSuccessResponse(
        { entries: getBoardEntries(), queue: getQueueInfo() },
        startTime,
        correlationId
      );
    }

    // 5c. POST /api/webhooks/payment (called by the payment provider, not by browsers)
    if (pathname === '/api/webhooks/payment' && method === 'POST') {
      const provider = getPaymentProvider();
      if (!provider) {
        return createErrorResponse(404, 'NO_PAYMENT_PROVIDER', 'Kein Zahlungsanbieter aktiv.', startTime, {
          correlationId,
        });
      }
      let event;
      try {
        event = provider.verifyWebhook(req.rawBody ?? '', req.headers || {});
      } catch {
        // Wrong signature or broken payload: tell the sender nothing more than that.
        return createErrorResponse(400, 'WEBHOOK_REJECTED', 'Signatur oder Inhalt ungültig.', startTime, {
          correlationId,
        });
      }
      // Verified events always get a 2xx, so the provider stops retrying.
      const outcome = applyPaymentEvent(event);
      return createSuccessResponse({ received: true, outcome }, startTime, correlationId);
    }

    // 5d. POST /api/payments/test/:ref (TEST provider only: plays the provider's part)
    if (pathname.startsWith('/api/payments/test/') && method === 'POST') {
      const provider = getPaymentProvider();
      const ref = pathname.replace('/api/payments/test/', '');
      const order = provider && provider.name === 'test' ? getOrderByPaymentRef(ref) : undefined;
      if (!provider || !order) {
        return createErrorResponse(404, 'PAYMENT_NOT_FOUND', 'Zahlung wurde nicht gefunden.', startTime, {
          correlationId,
        });
      }
      const outcome = body.outcome;
      if (outcome !== 'succeeded' && outcome !== 'failed' && outcome !== 'lost') {
        return createErrorResponse(400, 'INVALID_TEST_OUTCOME', 'outcome: succeeded | failed | lost.', startTime, {
          correlationId,
        });
      }
      let result = 'NO_WEBHOOK_SENT';
      if (outcome !== 'lost') {
        // Goes through the same signature check as a real webhook.
        const signed = buildTestWebhook({
          type: outcome === 'succeeded' ? 'payment.succeeded' : 'payment.failed',
          providerRef: ref,
          orderId: order.id,
          amountRappen: chfToRappen(order.totalChf),
          currency: 'CHF',
        });
        result = applyPaymentEvent(provider.verifyWebhook(signed.rawBody, signed.headers));
      }
      return createSuccessResponse(
        { outcome: result, returnUrl: `/order/${order.id}` },
        startTime,
        correlationId
      );
    }

    // 6. GET / POST /api/newsletter
    if (pathname === '/api/newsletter') {
      if (method === 'GET') {
        if (!isCrew) return crewRequired();
        return createSuccessResponse(
          { subscribers: getNewsletterOverview() },
          startTime,
          correlationId
        );
      }
      if (method === 'POST') {
        const payload = body as { email?: unknown; preferredPlz?: unknown; preferredQuarter?: unknown };
        const tooMany = limited('newsletter');
        if (tooMany) return tooMany;
        await requestSubscription(payload, req.baseUrl || '');
        // Same answer for new, pending and already confirmed addresses.
        const res: ApiResult = createSuccessResponse(
          { status: 'confirmation_sent' },
          startTime,
          correlationId
        );
        res.statusCode = 202;
        return res;
      }
    }

    // 6b. Double opt-in: confirm and unsubscribe (called by the pages behind the e-mail links)
    if (pathname === '/api/newsletter/confirm' && method === 'POST') {
      if (confirmSubscription(body.token) !== 'confirmed') {
        return createErrorResponse(
          400,
          'INVALID_OR_EXPIRED_TOKEN',
          'Der Link ist ungültig oder abgelaufen. Bitte neu anmelden.',
          startTime,
          { correlationId }
        );
      }
      return createSuccessResponse({ status: 'confirmed' }, startTime, correlationId);
    }

    if (pathname === '/api/newsletter/unsubscribe' && method === 'POST') {
      // Unknown tokens get the same answer: the address is not on the list afterwards either way.
      unsubscribe(body.token);
      return createSuccessResponse({ status: 'unsubscribed' }, startTime, correlationId);
    }

    // 7. GET / POST /api/b2b
    if (pathname === '/api/b2b') {
      if (method === 'GET') {
        if (!isCrew) return crewRequired();
        return createSuccessResponse({ inquiries: getB2BInquiries() }, startTime, correlationId);
      }
      if (method === 'POST') {
        const tooMany = limited('b2b');
        if (tooMany) return tooMany;
        const payload = body as unknown as Parameters<typeof createB2BInquiry>[0];
        const inq = createB2BInquiry(payload);
        return createCreatedResponse({ inquiry: inq }, startTime, correlationId);
      }
    }

    // 8. GET / PATCH /api/locations
    if (pathname === '/api/locations') {
      if (method === 'GET') {
        return createSuccessResponse(
          {
            locations: getTruckLocations(),
            liveLocationId: getLiveLocationId(),
            liveLocationUpdatedAt: getLiveLocationUpdatedAt(),
          },
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
          {
            locations,
            liveLocationId: getLiveLocationId(),
            liveLocationUpdatedAt: getLiveLocationUpdatedAt(),
          },
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

    if (message === 'ORDERS_PAUSED') {
      return createErrorResponse(
        409,
        'ORDERS_PAUSED',
        'Wir nehmen gerade keine neuen Bestellungen an. Bitte in ein paar Minuten nochmals versuchen.',
        startTime,
        { correlationId, fallbackAction: 'RETRY_REQUEST' }
      );
    }

    if (message === 'ORIGIN_NOT_DECLARED') {
      return createErrorResponse(422, 'ORIGIN_NOT_DECLARED', complianceConfig.texts.originMissing, startTime, {
        correlationId,
        fallbackAction: 'CONTACT_CREW',
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
