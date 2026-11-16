import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { handleApiRequest } from './lib/apiHandler.js';
import { renderOrderPageHtml } from './views/orderPage.js';
import { renderAdminPageHtml, renderCrewLoginPageHtml } from './views/adminPage.js';
import { renderBoardPageHtml } from './views/boardPage.js';
import { renderImpressumHtml, renderDatenschutzHtml } from './views/legalPages.js';
import { renderNewsletterActionHtml } from './views/newsletterPages.js';
import { renderTestPaymentPageHtml } from './views/testPaymentPage.js';
import {
  createOrder,
  getAllOrders,
  loadStoreFromDisk,
  expireStalePendingOrders,
  archiveFinishedOrders,
  confirmOrderPaymentAtCashier,
  getLiveLocationId,
  getOrderByPaymentRef,
} from './lib/orderStore.js';
import { purgeExpiredPendingSubscriptions } from './lib/newsletter.js';
import { pruneRateLimits } from './lib/rateLimit.js';
import { getUnverifiedComponents, validateComplianceConfig } from './config/compliance.js';
import { getLegalPlaceholders } from './config/legal.js';
import { getFeatureFlags } from './config/features.js';
import {
  CREW_COOKIE_NAME,
  getCrewPin,
  wasCrewPinGenerated,
  isCrewSession,
  parseCookies,
} from './lib/auth.js';

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const BUILD_DIR = path.join(ROOT_DIR, 'scrollcraft', 'builds', 'holy-basil');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const FONTS_DIR = path.join(ASSETS_DIR, 'fonts');
const MAX_BODY_BYTES = 32 * 1024;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/** Demo orders so the KDS is not empty. Only in demo mode and only on an empty store. */
async function seedInitialDemoOrdersIfEmpty(): Promise<void> {
  if (!getFeatureFlags().demoPayments) return;
  if (getAllOrders().length > 0) return;
  try {
    const paid = await createOrder({
      portions: [
        { variant: 'chicken', addKaiDao: true },
        { variant: 'chicken', addKaiDao: true },
        { variant: 'vegan', addKaiDao: false },
      ],
      drinks: [{ drinkId: 'thai_iced_tea', quantity: 2 }],
      paymentMethod: 'cash',
      preferredPlz: '8004',
      customerNote: 'Demo-Bestellung (bezahlt)',
    });
    confirmOrderPaymentAtCashier(paid.id, 'Demo');

    await createOrder({
      portions: [{ variant: 'pork_mix', addKaiDao: true }],
      drinks: [{ drinkId: 'coconut_water', quantity: 1 }],
      paymentMethod: 'cash',
      preferredPlz: '8050',
      customerNote: 'Demo-Bestellung (Bar offen)',
    });
  } catch (err) {
    console.error('[holy-basil] Demo-Bestellungen konnten nicht angelegt werden:', err);
  }
}

class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

/** Reads the body once and returns both the parsed JSON and the raw text (for webhook signatures). */
function readJsonBody(req: http.IncomingMessage): Promise<{ parsed: unknown; raw: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;

    req.on('data', (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejected = true;
        reject(new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Anfrage ist zu gross.'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (rejected) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({ parsed: {}, raw });
      try {
        resolve({ parsed: JSON.parse(raw), raw });
      } catch {
        reject(new HttpError(400, 'INVALID_JSON_BODY', 'Anfrage enthält kein gültiges JSON.'));
      }
    });
    req.on('error', () => {
      if (!rejected) reject(new HttpError(400, 'REQUEST_ABORTED', 'Anfrage abgebrochen.'));
    });
  });
}

function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {}
): void {
  res.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function sendHtml(res: http.ServerResponse, html: string, statusCode = 200): void {
  res.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(html);
}

function sendText(res: http.ServerResponse, statusCode: number, text: string): void {
  res.writeHead(statusCode, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

async function sendFile(
  res: http.ServerResponse,
  filePath: string,
  cacheControl: string
): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return false;
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Cache-Control': cacheControl,
    });
    fs.createReadStream(filePath)
      .on('error', () => res.destroy())
      .pipe(res);
    return true;
  } catch {
    return false;
  }
}

function publicBaseUrl(req: http.IncomingMessage): string {
  const fromEnv = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  const host = (req.headers.host || `localhost:${PORT}`).replace(/[^a-zA-Z0-9.:\-[\]]/g, '');
  return `http://${host}`;
}

/**
 * Address used for rate limiting. Behind a reverse proxy every request comes from the proxy,
 * so with TRUST_PROXY=1 the first X-Forwarded-For entry is used instead.
 */
function clientKeyOf(req: http.IncomingMessage): string {
  if (process.env.TRUST_PROXY === '1') {
    const forwarded = req.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
    if (first) return first.slice(0, 64);
  }
  return req.socket.remoteAddress || 'unknown';
}

/** Real, scannable QR code that points to the order app. */
async function renderOrderQrSvg(req: http.IncomingMessage): Promise<string | null> {
  try {
    const qr = await import('qrcode');
    const toString = qr.toString ?? qr.default?.toString;
    return await toString(`${publicBaseUrl(req)}/order`, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0A0C0A', light: '#F5F7F5' },
    });
  } catch {
    return null; // dependency not installed: the page hides the QR box
  }
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const urlObj = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;
  const method = (req.method || 'GET').toUpperCase();

  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies[CREW_COOKIE_NAME];
  const isCrew = isCrewSession(sessionToken);

  // 1. API Routes (/api/*)
  if (pathname.startsWith('/api/')) {
    let body: unknown;
    let rawBody: string | undefined;
    if (['POST', 'PATCH', 'PUT'].includes(method)) {
      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      if (!contentType.startsWith('application/json')) {
        throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type muss application/json sein.');
      }
      const read = await readJsonBody(req);
      body = read.parsed;
      rawBody = read.raw;
    }

    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    }

    const apiResult = await handleApiRequest({
      method,
      pathname,
      body,
      headers,
      isCrew,
      sessionToken,
      clientKey: clientKeyOf(req),
      secure: headers['x-forwarded-proto'] === 'https',
      rawBody,
      baseUrl: publicBaseUrl(req),
    });

    sendJson(res, apiResult.statusCode, apiResult.body, apiResult.headers);
    return;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    sendText(res, 405, '405 Method Not Allowed');
    return;
  }

  // 2. ScrollCraft Engine Files
  if (pathname === '/scrollcraft.css' || pathname === '/scrollcraft.js') {
    if (await sendFile(res, path.join(BUILD_DIR, pathname.slice(1)), 'public, max-age=3600')) return;
  }

  // 3. Static Brand Assets (/assets/*)
  if (pathname.startsWith('/assets/')) {
    let relName = '';
    try {
      relName = path.basename(decodeURIComponent(pathname));
    } catch {
      relName = '';
    }
    if (relName && (await sendFile(res, path.join(ASSETS_DIR, relName), 'public, max-age=86400'))) {
      return;
    }
  }

  // 3b. Self-hosted fonts (/fonts/*): no request to a font CDN
  if (pathname.startsWith('/fonts/')) {
    const name = path.basename(pathname);
    if (/^[a-z0-9-]+\.(woff2|css)$/.test(name)) {
      if (await sendFile(res, path.join(FONTS_DIR, name), 'public, max-age=31536000, immutable')) return;
    }
  }

  // 4. QR code to the order app
  if (pathname === '/qr.svg') {
    const svg = await renderOrderQrSvg(req);
    if (svg) {
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-store',
      });
      res.end(svg);
      return;
    }
  }

  // 5. Web Application Routes
  if (pathname === '/' || pathname === '/index.html') {
    try {
      const html = await fs.promises.readFile(path.join(BUILD_DIR, 'index.html'), 'utf8');
      sendHtml(res, html);
    } catch {
      sendText(res, 500, 'Landingpage nicht gefunden.');
    }
    return;
  }

  if (pathname === '/order' || pathname.startsWith('/order/')) {
    sendHtml(res, renderOrderPageHtml(getLiveLocationId()));
    return;
  }

  if (pathname === '/impressum') {
    sendHtml(res, renderImpressumHtml());
    return;
  }

  if (pathname === '/datenschutz') {
    sendHtml(res, renderDatenschutzHtml());
    return;
  }

  if (pathname === '/credits') {
    if (await sendFile(res, path.join(BUILD_DIR, 'credits.html'), 'public, max-age=3600')) return;
    sendText(res, 404, 'Foto-Credits nicht gefunden.');
    return;
  }

  // Pages behind the links in the newsletter e-mails. The action itself needs a tap (POST),
  // so a mail scanner that opens the link does not confirm or unsubscribe anybody.
  if (pathname === '/newsletter/confirm' || pathname === '/newsletter/unsubscribe') {
    const action = pathname.endsWith('confirm') ? 'confirm' : 'unsubscribe';
    sendHtml(res, renderNewsletterActionHtml(action, urlObj.searchParams.get('token') || ''));
    return;
  }

  // Payment page of the TEST provider (demo mode only).
  if (pathname.startsWith('/pay/test/') && getFeatureFlags().demoPayments) {
    const order = getOrderByPaymentRef(pathname.replace('/pay/test/', ''));
    if (order && order.payment) {
      sendHtml(res, renderTestPaymentPageHtml(order));
      return;
    }
  }

  if (pathname === '/admin' || pathname === '/kitchen') {
    sendHtml(res, isCrew ? renderAdminPageHtml() : renderCrewLoginPageHtml());
    return;
  }

  if (pathname === '/board') {
    sendHtml(res, renderBoardPageHtml());
    return;
  }

  sendText(res, 404, '404 Not Found');
}

/** Open points that block a real launch. Printed at server start. */
export function getReleaseGateWarnings(): string[] {
  const warnings: string[] = [...validateComplianceConfig()];
  const unverified = getUnverifiedComponents();
  if (unverified.length > 0) {
    warnings.push(
      `Allergene von ${unverified.length} Komponenten sind nicht mit Lieferantenspezifikation bestätigt (verified: false): ${unverified.join(', ')}`
    );
  }
  const placeholders = getLegalPlaceholders();
  if (placeholders.length > 0) {
    warnings.push(`Impressum/Datenschutz enthalten noch ${placeholders.length} Platzhalter (src/config/legal.ts).`);
  }
  if (getFeatureFlags().demoPayments) {
    warnings.push('Zahlung läuft über den Test-Provider. Kein echter Zahlungsanbieter angebunden.');
  }
  warnings.push('E-Mail-Versand ist ein Mock (data/outbox.json). Kein Versandanbieter angebunden.');
  return warnings;
}

export function createAppServer(): http.Server {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (err instanceof HttpError) {
        sendJson(
          res,
          err.statusCode,
          { success: false, error: { code: err.code, message: err.message } },
          err.statusCode === 413 ? { Connection: 'close' } : {}
        );
        return;
      }
      console.error('[holy-basil] Unbehandelter Fehler:', err);
      sendText(res, 500, '500 Internal Server Error');
    });
  });
}

/** True only when this file is the entry point (npm run dev / start), not when it is imported. */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return pathToFileURL(path.resolve(entry)).href.toLowerCase() === import.meta.url.toLowerCase();
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  const loaded = loadStoreFromDisk();
  const pin = getCrewPin();
  const demo = getFeatureFlags().demoPayments;

  seedInitialDemoOrdersIfEmpty().then(() => {
    // Housekeeping: abandoned unpaid orders free their Züri-Code, unconfirmed newsletter
    // requests are deleted, finished orders move to the archive.
    archiveFinishedOrders();
    setInterval(() => {
      expireStalePendingOrders();
      purgeExpiredPendingSubscriptions();
      pruneRateLimits();
    }, 30_000).unref();
    setInterval(() => archiveFinishedOrders(), 60 * 60 * 1000).unref();

    const server = createAppServer();
    server.listen(PORT, () => {
      console.log(`Holy Basil Server läuft auf http://localhost:${PORT}`);
      console.log(`  • Landingpage:        http://localhost:${PORT}/`);
      console.log(`  • Bestell-App:        http://localhost:${PORT}/order`);
      console.log(`  • Crew KDS (Login):   http://localhost:${PORT}/admin`);
      console.log(`  • Pickup Board:       http://localhost:${PORT}/board`);
      console.log('');
      console.log(
        `  Geladen: ${loaded.orders} Bestellungen, ${loaded.subscribers} Newsletter, ${loaded.inquiries} B2B-Anfragen`
      );
      console.log(
        demo
          ? '  Zahlung: DEMO (TWINT/Karte über den Test-Provider, es fliesst kein Geld)'
          : '  Zahlung: nur Bar am Truck (DEMO_PAYMENTS=1 schaltet den Test-Provider ein)'
      );
      console.log(
        wasCrewPinGenerated()
          ? `  Crew-PIN (zufällig, nur für diesen Start): ${pin}  -> fest setzen mit CREW_PIN=...`
          : '  Crew-PIN: aus CREW_PIN gesetzt'
      );

      // Release gate: open points that must be closed before real guests order.
      const gate = getReleaseGateWarnings();
      if (gate.length > 0) {
        console.warn('');
        console.warn('  ⚠ Vor dem Go-Live offen:');
        for (const line of gate) console.warn(`    - ${line}`);
      }
    });
  });
}
