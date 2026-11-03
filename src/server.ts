import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handleApiRequest } from './lib/apiHandler.js';
import { renderOrderPageHtml } from './views/orderPage.js';
import { renderAdminPageHtml } from './views/adminPage.js';
import { renderBoardPageHtml } from './views/boardPage.js';
import { createOrder, getAllOrders } from './lib/orderStore.js';

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const BUILD_DIR = path.join(ROOT_DIR, 'scrollcraft', 'builds', 'holy-basil');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');

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
};

async function seedInitialDemoOrdersIfEmpty(): Promise<void> {
  if (getAllOrders().length > 0) return;
  try {
    // 1. Paid digital order currently in Wok Demand (for Cook & Schöpfer)
    await createOrder({
      portions: [
        { variant: 'chicken', addKaiDao: true },
        { variant: 'chicken', addKaiDao: true },
        { variant: 'vegan', addKaiDao: false },
      ],
      drinks: [{ drinkId: 'thai_iced_tea', quantity: 2 }],
      paymentMethod: 'twint',
      preferredPlz: '8004',
      customerNote: 'Initial Demo Order (TWINT Paid)',
    });

    // 2. Cash order waiting at Kasse (Pending Cash)
    await createOrder({
      portions: [{ variant: 'pork_mix', addKaiDao: true }],
      drinks: [{ drinkId: 'coconut_water', quantity: 1 }],
      paymentMethod: 'cash',
      preferredPlz: '8050',
      customerNote: 'Initial Demo Order (Cash Pending)',
    });
  } catch {
    // Ignore seed errors
  }
}

function parseJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export function createAppServer(): http.Server {
  return http.createServer(async (req, res) => {
    const urlObj = new URL(req.url || '/', `http://localhost:${PORT}`);
    const pathname = urlObj.pathname;
    const method = req.method || 'GET';

    // 1. API Routes (/api/*)
    if (pathname.startsWith('/api/')) {
      const body = ['POST', 'PATCH', 'PUT'].includes(method.toUpperCase())
        ? await parseJsonBody(req)
        : undefined;

      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
      }

      const apiResult = await handleApiRequest({
        method,
        pathname,
        body,
        headers,
      });

      res.writeHead(apiResult.statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(apiResult.body));
      return;
    }

    // 2. ScrollCraft Engine Files
    if (pathname === '/scrollcraft.css' || pathname === '/scrollcraft.js') {
      const filePath = path.join(BUILD_DIR, pathname.slice(1));
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    // 3. Static Brand Assets (/assets/*)
    if (pathname.startsWith('/assets/')) {
      const relName = path.basename(decodeURIComponent(pathname));
      const assetPath = path.join(ASSETS_DIR, relName);
      if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
        const ext = path.extname(assetPath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        fs.createReadStream(assetPath).pipe(res);
        return;
      }
    }

    // 4. Web Application Routes
    if (pathname === '/' || pathname === '/index.html') {
      const indexHtmlPath = path.join(BUILD_DIR, 'index.html');
      const html = fs.readFileSync(indexHtmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (pathname === '/order' || pathname.startsWith('/order/')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderOrderPageHtml());
      return;
    }

    if (pathname === '/admin' || pathname === '/kitchen') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderAdminPageHtml());
      return;
    }

    if (pathname === '/board') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderBoardPageHtml());
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  });
}

// Start server if invoked directly
if (import.meta.url.endsWith('server.ts') || process.argv[1]?.endsWith('server.ts')) {
  seedInitialDemoOrdersIfEmpty().then(() => {
    const server = createAppServer();
    server.listen(PORT, () => {
      console.log(`Holy Basil Server running on http://localhost:${PORT}`);
      console.log(`  • Landing Page (Scroll-Craft): http://localhost:${PORT}/`);
      console.log(`  • Mobile QR-Order App:         http://localhost:${PORT}/order`);
      console.log(`  • Foodtruck Admin & KDS:       http://localhost:${PORT}/admin`);
      console.log(`  • Public Pickup Board:         http://localhost:${PORT}/board`);
      console.log(`  • NFR & SLA Health Check:      http://localhost:${PORT}/api/health`);
    });
  });
}
