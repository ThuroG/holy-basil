import { Order } from '../lib/types.js';
import { FONT_LINK, escHtml, scriptJson } from './shared.js';

/**
 * Payment page of the built-in TEST provider (demo mode only). It stands in for the hosted
 * checkout of a real provider: the three buttons decide which webhook the "provider" sends.
 * No money moves.
 */
export function renderTestPaymentPageHtml(order: Order): string {
  const cfg = scriptJson({
    endpoint: `/api/payments/test/${order.payment?.providerRef ?? ''}`,
    returnUrl: `/order/${order.id}`,
  });
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>TEST-ZAHLUNG · Holy Basil</title>
  ${FONT_LINK}
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #101418; color: #F5F7F5; padding: 1rem;
      font-family: "Plus Jakarta Sans", system-ui, sans-serif;
    }
    .card { width: 100%; max-width: 420px; background: #1A2028; border: 2px dashed #FFD54F; border-radius: 20px; padding: 1.5rem; text-align: center; }
    .tag { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 6px; background: #FFD54F; color: #141004; font-weight: 800; font-size: 0.78rem; }
    .amount { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 2.4rem; font-weight: 800; margin: 0.8rem 0 0.2rem 0; }
    p { color: #AEB8C2; font-size: 0.9rem; }
    button { width: 100%; min-height: 52px; margin-top: 0.6rem; border-radius: 12px; border: 0; font-weight: 800; font-size: 1rem; cursor: pointer; font-family: inherit; }
    .ok { background: #52C45A; color: #071209; }
    .fail { background: #E53935; color: #fff; }
    .lost { background: transparent; color: #AEB8C2; border: 1px solid #4A5562; font-weight: 600; font-size: 0.88rem; }
    button:disabled { opacity: 0.6; cursor: wait; }
    #msg { min-height: 1.2rem; margin-top: 0.7rem; color: #FF8A80; font-size: 0.88rem; }
  </style>
</head>
<body>
  <div class="card">
    <span class="tag">TEST-PROVIDER · ES FLIESST KEIN GELD</span>
    <div class="amount">CHF ${escHtml(order.totalChf.toFixed(2))}</div>
    <p>Holy Basil · Abholcode ${escHtml(order.zueriCode.formatted)} · ${escHtml(order.paymentMethod.toUpperCase())}</p>
    <button type="button" class="ok" data-outcome="succeeded">Zahlung erfolgreich</button>
    <button type="button" class="fail" data-outcome="failed">Zahlung abgelehnt</button>
    <button type="button" class="lost" data-outcome="lost">Bezahlt, aber Bestätigung geht verloren (kein Webhook)</button>
    <div id="msg" role="alert"></div>
  </div>
  <script>
    const CFG = ${cfg};
    document.querySelectorAll("button[data-outcome]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        document.querySelectorAll("button").forEach((b) => { b.disabled = true; });
        try {
          const res = await fetch(CFG.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outcome: btn.getAttribute("data-outcome") })
          });
          const json = await res.json();
          if (json.success) {
            window.location.href = CFG.returnUrl;
            return;
          }
          document.getElementById("msg").textContent = (json.error && json.error.message) || "Fehler";
        } catch {
          document.getElementById("msg").textContent = "Keine Verbindung.";
        }
        document.querySelectorAll("button").forEach((b) => { b.disabled = false; });
      });
    });
  </script>
</body>
</html>`;
}
