import { DESIGN_TOKENS_CSS, FONT_LINK, LOGO_STICKER_TRANSPARENT } from './shared.js';

export function renderAdminPageHtml(): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>HOLY BASIL · Foodtruck Operations, KDS & Admin</title>
  <link rel="icon" href="${LOGO_STICKER_TRANSPARENT}" type="image/svg+xml">
  ${FONT_LINK}
  <style>
    ${DESIGN_TOKENS_CSS}
    :root {
      --bg: var(--bg-primary);
      --surface: var(--bg-surface);
      --surface-2: var(--bg-elevated);
      --green-deep: #1B4D2E;
      --green-core: #2E7D32;
      --green-neon: var(--green-sunlight);
      --gold: #FFD54F;
      --chili: #E53935;
      --ink: var(--text-primary);
      --muted: var(--text-secondary);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--font-body);
    }
    .header {
      background: #0E130F;
      border-bottom: 2px solid rgba(82, 196, 90, 0.35);
      padding: 0.85rem 1.5rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.2rem;
      color: var(--ink);
      text-decoration: none;
    }
    .brand img { width: 38px; height: 38px; }
    .nav-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }
    .tab-btn {
      padding: 0.6rem 1rem;
      border-radius: 10px;
      border: 1.5px solid rgba(82, 196, 90, 0.3);
      background: var(--surface);
      color: var(--muted);
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 0.86rem;
      cursor: pointer;
    }
    .tab-btn.active {
      background: var(--green-neon);
      color: #061108;
      border-color: var(--green-neon);
    }
    .main-wrap {
      max-width: 1380px;
      margin: 0 auto;
      padding: 1.25rem 1.5rem 4rem 1.5rem;
    }
    /* ZERO-CLICK WOK DEMAND COCKPIT (FOR THE COOK) */
    .wok-cockpit-bar {
      background: linear-gradient(135deg, #152318 0%, #0D140F 100%);
      border: 2.5px solid var(--green-neon);
      border-radius: 20px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }
    .wok-header-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .wok-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }
    .wok-pan-card {
      background: #0A0E0B;
      border: 2px solid rgba(82, 196, 90, 0.45);
      border-radius: 16px;
      padding: 1.1rem;
      text-align: center;
    }
    .wok-pan-card--egg {
      border-color: var(--gold);
    }
    .wok-pan-count {
      font-family: var(--font-mono);
      font-size: 3.1rem;
      font-weight: 800;
      color: var(--green-neon);
      line-height: 1;
      margin: 0.35rem 0;
    }
    .wok-pan-card--egg .wok-pan-count {
      color: var(--gold);
    }
    .wok-pan-label {
      font-family: var(--font-display);
      font-size: 1.05rem;
      font-weight: 800;
    }
    .wok-spice-breakdown {
      font-family: var(--font-mono);
      font-size: 0.76rem;
      color: var(--muted);
      margin-top: 0.4rem;
    }
    /* PIPELINE COLUMNS */
    .stations-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.25rem;
    }
    .station-col {
      background: var(--surface);
      border: 1.5px solid rgba(82, 196, 90, 0.28);
      border-radius: 18px;
      padding: 1.15rem;
      min-height: 420px;
    }
    .station-col__title {
      font-family: var(--font-display);
      font-size: 1.1rem;
      margin: 0 0 0.25rem 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .station-col__sub {
      font-size: 0.8rem;
      color: var(--muted);
      margin-bottom: 1rem;
      padding-bottom: 0.65rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .order-ticket {
      background: #0B100C;
      border: 2px solid rgba(82, 196, 90, 0.35);
      border-radius: 14px;
      padding: 0.95rem;
      margin-bottom: 0.85rem;
    }
    .order-ticket--cash {
      border-color: var(--gold);
      background: rgba(255, 213, 79, 0.06);
    }
    .order-ticket--error {
      border-color: var(--chili);
      background: rgba(229, 57, 53, 0.12);
    }
    .order-code {
      font-family: var(--font-mono);
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--gold);
    }
    .action-btn {
      width: 100%;
      margin-top: 0.75rem;
      padding: 0.75rem;
      border-radius: 10px;
      border: 0;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .action-btn--cash {
      background: var(--gold);
      color: #141004;
    }
    .action-btn--plate {
      background: var(--green-core);
      color: var(--ink);
      border: 1.5px solid var(--green-neon);
    }
    .action-btn--qc {
      background: var(--green-neon);
      color: #061108;
    }
    .action-btn--done {
      background: #233026;
      color: var(--ink);
      border: 1px solid var(--muted);
    }
    .admin-panel-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      margin-top: 1.5rem;
    }
    .metric-box {
      background: #0B100C;
      border: 1px solid rgba(82, 196, 90, 0.3);
      border-radius: 12px;
      padding: 0.85rem;
    }
    .metric-val {
      font-family: var(--font-mono);
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--green-neon);
    }
    @media (max-width: 980px) {
      .wok-grid { grid-template-columns: repeat(2, 1fr); }
      .stations-grid, .admin-panel-grid { grid-template-columns: 1fr; }
    }
    .action-btn--ghost {
      background: transparent;
      color: var(--muted);
      border: 1px solid rgba(255, 255, 255, 0.25);
      font-weight: 600;
      font-size: 0.8rem;
      padding: 0.5rem;
    }
    .action-btn:disabled { opacity: 0.5; cursor: wait; }
    /* Peak-hour additions: batch buttons, ticket age, search, undo */
    .wok-pan-card--next { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(255, 213, 79, 0.5); }
    .wok-pan-sub { font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted); }
    .wok-next-tag {
      display: inline-block; margin-bottom: 0.3rem; padding: 0.1rem 0.45rem; border-radius: 6px;
      background: var(--gold); color: #141004; font-family: var(--font-mono); font-size: 0.7rem; font-weight: 800;
    }
    .batch-btn {
      width: 100%; min-height: 52px; margin-top: 0.6rem; border-radius: 12px; border: 0;
      background: var(--green-neon); color: #061108; font-family: var(--font-display);
      font-weight: 800; font-size: 0.95rem; cursor: pointer;
    }
    .batch-btn:disabled { background: #233026; color: var(--muted); cursor: not-allowed; }
    .cockpit-meta { font-family: var(--font-mono); font-size: 0.85rem; color: var(--ink); }
    .age {
      font-family: var(--font-mono); font-size: 0.74rem; font-weight: 700; padding: 0.1rem 0.4rem;
      border-radius: 6px; background: #1A231C; color: var(--muted); white-space: nowrap;
    }
    .age--warn { background: rgba(255, 213, 79, 0.2); color: var(--gold); }
    .age--late { background: rgba(229, 57, 53, 0.3); color: #FFCDD2; }
    .order-ticket--late { border-color: var(--chili); }
    .order-ticket--go { border-color: var(--green-neon); box-shadow: 0 0 0 1px var(--green-neon); }
    .order-ticket--refund { border-color: var(--chili); background: rgba(229, 57, 53, 0.16); }
    .ticket-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.25rem 0.5rem; }
    .ticket-head > span { white-space: nowrap; }
    .box-state { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; }
    .box-state--fire { color: var(--green-neon); }
    .box-state--wait { color: var(--muted); }
    .kasse-search {
      width: 100%; padding: 0.7rem; margin-bottom: 0.75rem; border-radius: 10px;
      border: 1.5px solid var(--gold); background: #0A0D0B; color: var(--ink);
      font-family: var(--font-mono); font-size: 1.2rem; letter-spacing: 0.12em;
    }
    .action-btn { min-height: 48px; }
    #toast button {
      margin-left: 0.8rem; padding: 0.45rem 0.8rem; border-radius: 8px; border: 0;
      background: var(--ink); color: #0A0C0A; font-weight: 800; cursor: pointer;
    }
  </style>
</head>
<body>

  <header class="header">
    <a class="brand" href="/">
      <img src="${LOGO_STICKER_TRANSPARENT}" alt="Holy Basil">
      <span>HOLY BASIL · FOODTRUCK OPERATIONS &amp; ADMIN</span>
    </a>
    <div class="nav-pills">
      <button type="button" class="tab-btn active" data-filter="all">Alle Stationen</button>
      <button type="button" class="tab-btn" data-filter="kasse">1. Kasse</button>
      <button type="button" class="tab-btn" data-filter="wok">2. Wok (Koch)</button>
      <button type="button" class="tab-btn" data-filter="schoepfer">3. Schöpfer</button>
      <button type="button" class="tab-btn" data-filter="qc">4. QC &amp; Drinks</button>
      <a href="/order" class="tab-btn" style="text-decoration: none; color: var(--gold);">+ Gast-Bestellung</a>
      <a href="/board" class="tab-btn" style="text-decoration: none; color: var(--green-neon);">TV Pickup Board</a>
      <button type="button" class="tab-btn" id="btnLogout">Abmelden</button>
    </div>
  </header>

  <main class="main-wrap">
    <div id="connectionState" role="status" style="color: #FF8A80; font-family: var(--font-mono); font-size: 0.85rem;"></div>
    <div id="demoBanner" style="display: none; margin-bottom: 0.9rem; padding: 0.6rem 0.9rem; border-radius: 10px; border: 1.5px solid var(--gold); color: var(--gold); font-size: 0.85rem;">
      DEMO-MODUS: TWINT und Karte laufen über den Test-Provider. Es fliesst kein Geld.
    </div>
    <div id="pausedBanner" style="display: none; margin-bottom: 0.9rem; padding: 0.6rem 0.9rem; border-radius: 10px; border: 1.5px solid var(--chili); color: #FFCDD2; font-size: 0.9rem; font-weight: 700;">
      ANNAHME PAUSIERT: Gäste können gerade nicht bestellen.
    </div>

    <!-- STATION 2: WOK DEMAND COCKPIT FOR THE COOK -->
    <section class="wok-cockpit-bar" id="wokCockpitSection">
      <div class="wok-header-row">
        <div>
          <span style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--gold); font-weight: 700;">
            🔥 STATION 2 · WOK DEMAND (KOCH)
          </span>
          <h2 style="font-family: var(--font-display); font-size: 1.4rem; margin: 0.2rem 0 0 0;">
            Noch zu braten (nur bezahlte Portionen)
          </h2>
          <div class="cockpit-meta" id="cockpitMeta"></div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 0.65rem; align-items: center;">
          <button type="button" class="tab-btn" id="btnTogglePause">Annahme pausieren</button>
          <span id="demoTools" style="display: none; gap: 0.65rem; align-items: center;">
            <button type="button" class="tab-btn" id="btnSeedDemoOrder" style="border-color: var(--gold); color: var(--gold);">
              ⚡ Test-Bestellung
            </button>
            <button type="button" class="tab-btn" id="btnSimulatePaymentFallback" style="border-color: var(--chili); color: #FF8A80;">
              ⚠️ Zahlungs-Fallback testen
            </button>
          </span>
        </div>
      </div>

      <div class="wok-grid" id="wokGrid"></div>
    </section>

    <!-- 3 INTERACTIVE CREW STATIONS: KASSE -> SCHÖPFER -> QC & DRINKS -->
    <section class="stations-grid" id="stationsGrid">
      <div class="station-col" id="colKasse">
        <div class="station-col__title">
          <span>💵 1. Kasse &amp; Zahlungsfreigabe</span>
          <span style="font-family: var(--font-mono); color: var(--gold);" id="countKasse">0</span>
        </div>
        <div class="station-col__sub">
          Gast nennt den Code, zahlt, 1 Tap schickt die Bestellung in den Wok
        </div>
        <label for="kasseSearch" style="position:absolute;left:-9999px;">Code suchen</label>
        <input id="kasseSearch" class="kasse-search" type="text" inputmode="numeric" autocomplete="off" placeholder="Code suchen, z. B. 8004">
        <div id="listKasse"></div>
      </div>

      <div class="station-col" id="colSchoepfer">
        <div class="station-col__title">
          <span>🍱 3. Schöpfer (Boxen packen)</span>
          <span style="font-family: var(--font-mono); color: var(--green-neon);" id="countSchoepfer">0</span>
        </div>
        <div class="station-col__sub">
          Grün umrandet = alle Boxen sind im Wok gestartet. Älteste zuerst.
        </div>
        <div id="listSchoepfer"></div>
      </div>

      <div class="station-col" id="colQc">
        <div class="station-col__title">
          <span>🔔 4. Qualitätskontrolle &amp; Drinks</span>
          <span style="font-family: var(--font-mono); color: var(--green-neon);" id="countQc">0</span>
        </div>
        <div class="station-col__sub">
          Boxen prüfen, Getränke dazustellen, Züri-Code aufrufen &amp; übergeben
        </div>
        <div id="listQc"></div>
      </div>
    </section>

    <!-- ADMIN, FEATURE TOGGLE & NFR SLA TELEMETRY -->
    <section class="admin-panel-grid">
      <div class="station-col" style="min-height: auto;">
        <div class="station-col__title">
          <span>⚙️ Einstellungen</span>
        </div>
        <div class="station-col__sub">
          Schärfegrad-Auswahl und Standort
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; background: #0B100C; padding: 1rem; border-radius: 12px; border: 1.5px solid rgba(82, 196, 90, 0.35);">
          <div>
            <div style="font-weight: 700;">Individuelle Schärfegrade erlauben</div>
            <div style="font-size: 0.8rem; color: var(--muted);" id="spiceToggleStatusText"></div>
          </div>
          <button type="button" class="tab-btn active" id="btnToggleSpiceFeature">
            Umschalten
          </button>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; background: #0B100C; padding: 1rem; border-radius: 12px; border: 1.5px solid rgba(82, 196, 90, 0.35); margin-top: 0.65rem;">
          <div>
            <div style="font-weight: 700;">Holy Gains 💪 (+ CHF 3.50 Extra Protein)</div>
            <div style="font-size: 0.8rem; color: var(--muted);" id="holyGainsToggleStatusText"></div>
          </div>
          <button type="button" class="tab-btn active" id="btnToggleHolyGainsFeature">
            Umschalten
          </button>
        </div>

        <div style="margin-top: 1rem; font-weight: 700;">Truck-Standort heute</div>
        <div style="font-size: 0.8rem; color: var(--muted); margin-bottom: 0.5rem;">
          Steuert «Heute live» auf der Landingpage und die deklarierte Fleischherkunft.
        </div>
        <div id="locationButtons" style="display: flex; flex-wrap: wrap; gap: 0.45rem;"></div>
      </div>

      <div class="station-col" style="min-height: auto;">
        <div class="station-col__title">
          <span>🛡️ System (SLA &amp; Health)</span>
        </div>
        <div class="station-col__sub">
          Messwerte seit Serverstart. Ziele: &lt; 1000ms Latenz · 99.5% beantwortete Anfragen
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
          <div class="metric-box">
            <div style="font-size: 0.75rem; color: var(--muted);">Digitale Zahlungen OK</div>
            <div class="metric-val" id="slaPayment">–</div>
          </div>
          <div class="metric-box">
            <div style="font-size: 0.75rem; color: var(--muted);">Ø API Latenz (&lt;1s)</div>
            <div class="metric-val" id="slaLatency">–</div>
          </div>
          <div class="metric-box">
            <div style="font-size: 0.75rem; color: var(--muted);">API Availability</div>
            <div class="metric-val" id="slaAvail">–</div>
          </div>
        </div>
      </div>
    </section>

  </main>

  <div id="toast" role="alert" style="display: none; position: fixed; left: 50%; bottom: 1.5rem; transform: translateX(-50%); background: #3A1412; border: 2px solid var(--chili); color: #FFCDD2; padding: 0.8rem 1.2rem; border-radius: 12px; font-weight: 700; z-index: 100; max-width: 90vw;"></div>

  <script>
    const VARIANT_LABELS = { vegan: "🌱 Holy Vegan", chicken: "🍗 Holy Chicken", pork_mix: "🥩 Holy Pork/Mix" };
    const WOK_LABELS = { chicken: "🍗 HOLY CHICKEN", vegan: "🌱 HOLY VEGAN", pork_mix: "🥩 PORK / MIX" };
    const WOK_ORDER = ["chicken", "vegan", "pork_mix"];
    const DRINK_LABELS = { thai_iced_tea: "🧋 Thai Iced Tea", coconut_water: "🥥 Kokoswasser", zueri_mate: "⚡ Züri Mate" };
    const SPICE_TEXT = {
      mild: "0 · ไม่เผ็ด (Nicht scharf)",
      leicht_scharf: "1 🌶️ · เผ็ดนิดหน่อย",
      original_thai_spicy: "2 🌶️🌶️ · เผ็ดมาก",
      extra_hot: "3 🔥🔥🔥 · Extra Hot"
    };
    const REFUND_REASONS = {
      PAID_AFTER_CANCEL: "Online bezahlt, nachdem die Bestellung storniert war",
      DOUBLE_PAYMENT: "Doppelt bezahlt: bar an der Kasse und online",
      AMOUNT_MISMATCH: "Online-Betrag stimmt nicht mit der Bestellung überein"
    };
    const UNPAID = ["pending_cash", "pending_payment", "payment_error_fallback"];
    const WARN_MIN = 5;
    const LATE_MIN = 10;

    let currentCustomSpice = false;
    let currentHolyGains = false;
    let ordersPaused = false;
    let kasseFilter = "";
    let clockOffset = 0;        // server time minus tablet time, so ages are right on any tablet
    let lastOrders = null;
    let lastWok = null;
    const pending = new Set();  // ticket ids / keys with a request in flight
    const lastHtml = {};

    // Every value that comes from the server goes through esc() before it lands in innerHTML.
    function esc(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
      ));
    }

    function chf(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n.toFixed(2) : "?";
    }

    // Only touch the DOM when something changed, so a tap is never lost to a re-render.
    function setHtml(id, html) {
      if (lastHtml[id] === html) return;
      lastHtml[id] = html;
      document.getElementById(id).innerHTML = html;
    }

    function setText(id, text) {
      const el = document.getElementById(id);
      if (el.textContent !== text) el.textContent = text;
    }

    let toastTimer = null;
    function showToast(message, undoId) {
      const el = document.getElementById("toast");
      el.textContent = message;
      el.style.background = undoId ? "#123018" : "#3A1412";
      el.style.borderColor = undoId ? "var(--green-neon)" : "var(--chili)";
      el.style.color = undoId ? "#F5F7F5" : "#FFCDD2";
      if (undoId) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Rückgängig";
        btn.addEventListener("click", () => {
          el.style.display = "none";
          runAction(undoId, () => api("/api/orders/" + encodeURIComponent(undoId), "PATCH", { action: "undo" }));
        });
        el.appendChild(btn);
      }
      el.style.display = "block";
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { el.style.display = "none"; }, undoId ? 8000 : 5000);
    }

    async function api(path, method, body) {
      const res = await fetch(path, {
        method: method || "GET",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      if (res.status === 401) {
        window.location.reload(); // session expired -> back to the PIN screen
        throw new Error("Sitzung abgelaufen");
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error((json.error && json.error.message) || "Aktion fehlgeschlagen");
      }
      if (json.meta && json.meta.timestamp) {
        clockOffset = Date.parse(json.meta.timestamp) - Date.now();
      }
      return json.data;
    }

    function minutesSince(iso) {
      const t = Date.parse(iso);
      if (Number.isNaN(t)) return 0;
      return Math.max(0, Math.floor((Date.now() + clockOffset - t) / 60000));
    }

    function ageBadge(iso) {
      const m = minutesSince(iso);
      const cls = m >= LATE_MIN ? " age--late" : m >= WARN_MIN ? " age--warn" : "";
      return '<span class="age' + cls + '">' + (m < 1 ? "neu" : m + " Min") + '</span>';
    }

    function formatSpiceBreakdown(batch) {
      const parts = [];
      if (batch.bySpice.mild) parts.push(batch.bySpice.mild + "x ไม่เผ็ด");
      if (batch.bySpice.leicht_scharf) parts.push(batch.bySpice.leicht_scharf + "x 🌶️ เผ็ดนิดหน่อย");
      if (batch.bySpice.original_thai_spicy) parts.push(batch.bySpice.original_thai_spicy + "x 🌶️🌶️ เผ็ดมาก");
      if (batch.bySpice.extra_hot) parts.push(batch.bySpice.extra_hot + "x 🔥🔥🔥 Extra Hot");
      return parts.join(" · ");
    }

    function renderWok(wok) {
      return WOK_ORDER.map((v) => {
        const b = wok.batches[v];
        const next = wok.nextVariant === v;
        const key = "batch:" + v;
        return '<div class="wok-pan-card' + (next ? ' wok-pan-card--next' : '') + '">' +
          (next ? '<div class="wok-next-tag">ALS NÄCHSTES</div>' : '') +
          '<div class="wok-pan-label">' + WOK_LABELS[v] + '</div>' +
          '<div class="wok-pan-count">' + esc(b.queuedPortions) + '</div>' +
          '<div class="wok-pan-sub">im Wok: ' + esc(b.cookingPortions) +
            (b.queuedPortions > 0 ? ' · ältestes wartet ' + esc(b.oldestWaitingMinutes) + ' Min' : '') + '</div>' +
          (wok.customSpiceEnabled && b.totalPortions > 0
            ? '<div class="wok-spice-breakdown">' + esc(formatSpiceBreakdown(b)) + '</div>' : '') +
          '<button type="button" class="batch-btn" data-batch="' + v + '"' +
            (b.nextBatchSize === 0 || pending.has(key) ? ' disabled' : '') + '>' +
            (b.nextBatchSize > 0 ? '🔥 Batch starten (' + esc(b.nextBatchSize) + ')' : 'Nichts offen') +
          '</button>' +
        '</div>';
      }).join("") +
      '<div class="wok-pan-card wok-pan-card--egg">' +
        '<div class="wok-pan-label">🍳 KAI DAO EIER</div>' +
        '<div class="wok-pan-count">' + esc(wok.totalKaiDaoEggs) + '</div>' +
        '<div class="wok-pan-sub">💪 Holy Gains: ' + esc(wok.totalHolyGains || 0) + '</div>' +
      '</div>';
    }

    function renderPortionSummary(order, showWokState) {
      return order.portions.map((p) =>
        '<div style="font-size: 0.85rem; margin-top: 0.25rem;">• Box ' + esc(p.portionIndex) + ': <strong>' +
        esc(VARIANT_LABELS[p.variant] || p.variant) + '</strong>' +
        (p.addKaiDao ? '<span style="color:var(--gold);font-weight:700;"> + Kai Dao 🍳</span>' : '') +
        (p.holyGains ? '<span style="color:var(--green-neon);font-weight:700;"> + Holy Gains 💪</span>' : '') +
        ' <span style="color:var(--muted);font-size:0.76rem;">(' + esc(SPICE_TEXT[p.spiceLevel] || p.spiceLevel) + ')</span>' +
        (showWokState
          ? (p.firedAt ? ' <span class="box-state box-state--fire">🔥 im Wok</span>' : ' <span class="box-state box-state--wait">⏳ wartet</span>')
          : '') +
        '</div>'
      ).join("");
    }

    function renderDrinkSummary(order) {
      if (!order.drinks || order.drinks.length === 0) {
        return '<div style="font-size: 0.78rem; color: var(--muted); margin-top: 0.4rem;">Keine Getränke</div>';
      }
      return '<div style="margin-top: 0.5rem; padding: 0.45rem 0.65rem; border-radius: 8px; background: rgba(255, 213, 79, 0.15); border: 1px solid var(--gold); color: var(--gold); font-size: 0.82rem; font-weight: 700;">' +
        '🥤 GETRÄNKE RICHTEN: ' + order.drinks.map((d) => esc(d.quantity) + "x " + esc(DRINK_LABELS[d.drinkId] || d.drinkId)).join(", ") +
        '</div>';
    }

    function actionBtn(cls, action, id, label, status) {
      return '<button type="button" class="action-btn ' + cls + '" data-action="' + action + '" data-id="' + esc(id) + '"' +
        (status ? ' data-status="' + status + '"' : '') + (pending.has(id) ? ' disabled' : '') + '>' + label + '</button>';
    }

    function renderRefund(o) {
      return '<div class="order-ticket order-ticket--refund">' +
        '<div class="ticket-head">' +
          '<span class="order-code">' + esc(o.zueriCode.formatted) + '</span>' +
          '<strong style="font-family:var(--font-mono);font-size:1.05rem;">CHF ' + chf(o.refundDue.amountChf) + '</strong>' +
        '</div>' +
        '<div style="font-size:0.82rem;font-weight:700;margin-top:0.3rem;">↩️ RÜCKERSTATTUNG OFFEN</div>' +
        '<div style="font-size:0.8rem;margin-top:0.2rem;">' + esc(REFUND_REASONS[o.refundDue.reason] || o.refundDue.reason) + '</div>' +
        '<div style="font-size:0.74rem;color:var(--muted);margin-top:0.2rem;">Referenz: ' + esc(o.refundDue.providerRef) + '</div>' +
        actionBtn('action-btn--cash', 'refund_done', o.id, '✓ CHF ' + chf(o.refundDue.amountChf) + ' zurückerstattet') +
      '</div>';
    }

    function renderKasse(orders, refunds, hidden) {
      if (orders.length === 0 && refunds.length === 0) {
        return '<div style="color:var(--muted);font-size:0.85rem;">' +
          (hidden > 0 ? 'Kein Treffer für «' + esc(kasseFilter) + '». ' + hidden + ' offene Zahlung(en) ausgeblendet.' : 'Keine offenen Zahlungen an der Kasse.') +
          '</div>';
      }
      return refunds.map(renderRefund).join("") + orders.map((o) => {
        const isError = o.status === "payment_error_fallback";
        const isOnline = o.status === "pending_payment";
        const label = isError
          ? '⚠️ ZAHLUNG NICHT BESTÄTIGT: an der Kasse klären'
          : isOnline
            ? '📱 ONLINE-ZAHLUNG LÄUFT (bar kassieren möglich)'
            : '💵 BARZAHLUNG AM TRUCK (offen)';
        return '<div class="order-ticket ' + (isError ? 'order-ticket--error' : 'order-ticket--cash') + '">' +
          '<div class="ticket-head">' +
            '<span class="order-code">' + esc(o.zueriCode.formatted) + '</span>' +
            '<span>' + ageBadge(o.createdAt) + ' <strong style="font-family:var(--font-mono);font-size:1.05rem;">CHF ' + chf(o.totalChf) + '</strong></span>' +
          '</div>' +
          '<div style="font-size:0.78rem;color:var(--gold);margin-top:0.2rem;">' + label + '</div>' +
          renderPortionSummary(o, false) +
          actionBtn('action-btn--cash', 'confirm_cash', o.id, '✓ CHF ' + chf(o.totalChf) + ' kassiert · In den Wok freigeben') +
          actionBtn('action-btn--ghost', 'cancel', o.id, 'Stornieren (nicht bezahlt)') +
        '</div>';
      }).join("") +
      (hidden > 0 ? '<div style="color:var(--muted);font-size:0.8rem;">' + hidden + ' weitere ausgeblendet (Suche aktiv).</div>' : '');
    }

    function renderSchoepfer(orders) {
      if (orders.length === 0) return '<div style="color:var(--muted);font-size:0.85rem;">Keine Boxen zum Schöpfen offen.</div>';
      return orders.map((o) => {
        const allFired = o.portions.every((p) => p.firedAt);
        const late = minutesSince(o.paidAt || o.createdAt) >= LATE_MIN;
        return '<div class="order-ticket' + (allFired ? ' order-ticket--go' : late ? ' order-ticket--late' : '') + '">' +
          '<div class="ticket-head">' +
            '<span class="order-code">' + esc(o.zueriCode.formatted) + '</span>' +
            '<span>' + ageBadge(o.paidAt || o.createdAt) + ' <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--green-neon);">' + esc(o.totalPortions) + ' Box(en)</span></span>' +
          '</div>' +
          (allFired ? '<div class="box-state box-state--fire" style="margin-top:0.25rem;">ALLES IM WOK · SCHÖPFEN</div>' : '') +
          renderPortionSummary(o, true) +
          actionBtn('action-btn--plate', 'advance', o.id, '🍱 Boxen geschöpft · Weiter an QC &amp; Drinks', 'plating') +
        '</div>';
      }).join("");
    }

    function renderQc(orders) {
      if (orders.length === 0) return '<div style="color:var(--muted);font-size:0.85rem;">Keine Bestellungen in der QC / Ausgabe.</div>';
      return orders.map((o) => {
        const ready = o.status === "ready";
        const since = ready ? o.readyAt : o.platedAt;
        const noShow = ready && minutesSince(since) >= WARN_MIN;
        return '<div class="order-ticket' + (noShow ? ' order-ticket--late' : '') + '" style="' + (ready && !noShow ? 'border-color:var(--gold);background:#142418;' : '') + '">' +
          '<div class="ticket-head">' +
            '<span class="order-code">' + esc(o.zueriCode.formatted) + '</span>' +
            '<span>' + ageBadge(since) + ' <span style="font-family:var(--font-mono);font-size:0.78rem;color:' + (ready ? 'var(--gold)' : 'var(--ink)') + ';">' +
              (noShow ? '⚠️ NICHT ABGEHOLT' : ready ? '🔔 AUFGERUFEN' : 'QC PRÜFUNG') +
            '</span></span>' +
          '</div>' +
          renderPortionSummary(o, false) +
          renderDrinkSummary(o) +
          (ready
            ? actionBtn('action-btn--done', 'advance', o.id, '✓ An Gast übergeben (Abschliessen)', 'completed')
            : actionBtn('action-btn--qc', 'advance', o.id, '🔔 QC OK &amp; Drinks bereit · JETZT AUFRUFEN', 'ready')) +
        '</div>';
      }).join("");
    }

    function renderLocations(data) {
      const closed = data.liveLocationId === null;
      return data.locations.map((l) =>
        '<button type="button" class="tab-btn ' + (l.status === "live_now" ? 'active' : '') + '" data-location="' + esc(l.id) + '">' +
          esc(l.plz) + ' ' + esc(l.quarter) +
        '</button>'
      ).join("") +
      '<button type="button" class="tab-btn ' + (closed ? 'active' : '') + '" data-location="">Truck geschlossen</button>';
    }

    // Draws all stations from the last data. Also called every 20 s so the ages keep moving.
    function renderStations() {
      if (!lastOrders || !lastWok) return;
      setHtml("wokGrid", renderWok(lastWok));

      // Oldest first: the crew works the queue top to bottom.
      const queue = lastOrders.slice().reverse();
      const refunds = queue.filter((o) => o.refundDue && !o.refundDue.resolvedAt);
      const unpaid = queue.filter((o) => UNPAID.includes(o.status));
      const filter = kasseFilter.trim();
      const kasse = filter ? unpaid.filter((o) => String(o.zueriCode.plz).startsWith(filter)) : unpaid;
      const paidAt = (o) => Date.parse(o.paidAt || o.createdAt);
      const schoepfer = queue
        .filter((o) => o.status === "received" || o.status === "in_wok")
        .sort((a, b) => {
          // Orders whose boxes are all in the wok come first, then the longest waiting.
          const fa = a.portions.every((p) => p.firedAt) ? 0 : 1;
          const fb = b.portions.every((p) => p.firedAt) ? 0 : 1;
          return fa - fb || paidAt(a) - paidAt(b);
        });
      const qc = queue
        .filter((o) => o.status === "plating" || o.status === "ready")
        .sort((a, b) => Date.parse(a.platedAt || a.createdAt) - Date.parse(b.platedAt || b.createdAt));

      setText("countKasse", String(unpaid.length + refunds.length));
      setHtml("listKasse", renderKasse(kasse, refunds, unpaid.length - kasse.length));
      setText("countSchoepfer", String(schoepfer.length));
      setHtml("listSchoepfer", renderSchoepfer(schoepfer));
      setText("countQc", String(qc.length));
      setHtml("listQc", renderQc(qc));
    }

    async function refreshOrders() {
      try {
        const ordData = await api("/api/orders");
        lastOrders = ordData.orders;
        lastWok = ordData.wokDemand;
        currentCustomSpice = lastWok.customSpiceEnabled;

        setText("cockpitMeta", "Wartezeit ca. " + lastWok.estimatedWaitMinutes + " Min · " +
          lastWok.totalActivePortions + " Portionen offen · " + ordData.totalOrdersToday + " Bestellungen heute");
        renderStations();

        document.getElementById("demoTools").style.display = ordData.demoPayments ? "inline-flex" : "none";
        document.getElementById("demoBanner").style.display = ordData.demoPayments ? "block" : "none";
        setText("spiceToggleStatusText", currentCustomSpice
          ? "Aktuell: AKTIV (0: ไม่เผ็ด / 1: เผ็ดนิดหน่อย / 2: เผ็ดมาก)"
          : "Aktuell: AUS (nur Standardschärfe เผ็ดนิดหน่อย für maximalen Wok-Speed)");
        setText("connectionState", "");
      } catch (err) {
        setText("connectionState", "⚠️ Keine Verbindung zum Server. Anzeige ist evtl. veraltet.");
      }
    }

    // Slow-changing data: no need to ask for it every two seconds.
    async function refreshSlow() {
      try {
        const [health, locData] = await Promise.all([api("/api/health"), api("/api/locations")]);
        currentHolyGains = Boolean(health.features.enableHolyGains);
        setText("holyGainsToggleStatusText", currentHolyGains
          ? "Aktuell: AKTIV (+ CHF 3.50 pro Portion wählbar)"
          : "Aktuell: AUS (Standard-Portionsgrösse)");
        ordersPaused = Boolean(health.features.ordersPaused);
        setText("btnTogglePause", ordersPaused ? "▶ Annahme fortsetzen" : "⏸ Annahme pausieren");
        document.getElementById("pausedBanner").style.display = ordersPaused ? "block" : "none";
        setText("slaPayment", health.metrics.paymentAttempts > 0 ? health.metrics.paymentReliabilityRate.toFixed(1) + "%" : "–");
        setText("slaLatency", health.metrics.avgLatencyMs + " ms");
        setText("slaAvail", health.metrics.availabilityRate.toFixed(2) + "%");
        setHtml("locationButtons", renderLocations(locData));
      } catch {}
    }

    // One request per ticket at a time. Other tickets stay tappable while it runs.
    async function runAction(key, fn, undoMessage) {
      if (pending.has(key)) return;
      pending.add(key);
      renderStations();
      try {
        await fn();
        if (undoMessage) showToast(undoMessage, key);
      } catch (err) {
        showToast("Nicht ausgeführt: " + (err && err.message ? err.message : "Fehler"));
      } finally {
        pending.delete(key);
        await refreshOrders();
        renderStations();
      }
    }

    function codeOf(id) {
      const o = (lastOrders || []).find((x) => x.id === id);
      return o ? o.zueriCode.formatted : "";
    }

    // One listener for all order buttons (event delegation), independent of re-renders.
    document.getElementById("stationsGrid").addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn || btn.disabled) return;
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      const url = "/api/orders/" + encodeURIComponent(id);

      if (action === "confirm_cash") {
        runAction(id, () => api(url, "PATCH", { action: "confirm_cash", note: "An Kasse bestätigt" }));
      } else if (action === "cancel") {
        if (!window.confirm("Bestellung " + codeOf(id) + " wirklich stornieren?")) return;
        runAction(id, () => api(url, "PATCH", { status: "cancelled", note: "An Kasse storniert" }));
      } else if (action === "refund_done") {
        runAction(id, () => api(url, "PATCH", { action: "refund_done", note: "An Kasse zurückerstattet" }));
      } else if (action === "advance") {
        const status = btn.getAttribute("data-status");
        const labels = { plating: "geschöpft", ready: "aufgerufen", completed: "übergeben" };
        runAction(id, () => api(url, "PATCH", { status }), codeOf(id) + " " + (labels[status] || status) + ".");
      }
    });

    document.getElementById("wokGrid").addEventListener("click", (event) => {
      const btn = event.target.closest("[data-batch]");
      if (!btn || btn.disabled) return;
      const variant = btn.getAttribute("data-batch");
      runAction("batch:" + variant, () => api("/api/wok/batch", "POST", { variant }));
    });

    document.getElementById("kasseSearch").addEventListener("input", (event) => {
      kasseFilter = event.target.value.replace(/[^0-9]/g, "");
      renderStations();
    });

    document.getElementById("locationButtons").addEventListener("click", (event) => {
      const btn = event.target.closest("[data-location]");
      if (!btn) return;
      const id = btn.getAttribute("data-location");
      runAction("location", async () => {
        await api("/api/locations", "PATCH", { locationId: id || null });
        await refreshSlow();
      });
    });

    document.getElementById("btnToggleSpiceFeature").addEventListener("click", () => {
      runAction("spice", () => api("/api/features", "PATCH", { enableCustomSpiceLevels: !currentCustomSpice }));
    });

    document.getElementById("btnToggleHolyGainsFeature").addEventListener("click", () => {
      runAction("holyGains", async () => {
        await api("/api/features", "PATCH", { enableHolyGains: !currentHolyGains });
        await refreshSlow();
      });
    });

    document.getElementById("btnTogglePause").addEventListener("click", () => {
      runAction("pause", async () => {
        await api("/api/features", "PATCH", { ordersPaused: !ordersPaused });
        await refreshSlow();
      });
    });

    document.getElementById("btnSeedDemoOrder").addEventListener("click", () => {
      runAction("seed", () => api("/api/orders", "POST", {
        portions: [
          { variant: "chicken", addKaiDao: true },
          { variant: "vegan", addKaiDao: false }
        ],
        drinks: [{ drinkId: "thai_iced_tea", quantity: 2 }],
        paymentMethod: "cash"
      }));
    });

    document.getElementById("btnSimulatePaymentFallback").addEventListener("click", () => {
      runAction("seed", () => api("/api/orders", "POST", {
        portions: [{ variant: "pork_mix", addKaiDao: true }],
        drinks: [{ drinkId: "coconut_water", quantity: 1 }],
        paymentMethod: "card",
        simulatePaymentFailure: true
      }));
    });

    document.getElementById("btnLogout").addEventListener("click", async () => {
      try { await api("/api/crew/logout", "POST", {}); } catch {}
      window.location.reload();
    });

    // Role Filter Tabs
    document.querySelectorAll(".nav-pills .tab-btn[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-pills .tab-btn[data-filter]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const f = btn.getAttribute("data-filter");
        document.getElementById("wokCockpitSection").style.display = (f === "all" || f === "wok") ? "block" : "none";
        document.getElementById("colKasse").style.display = (f === "all" || f === "kasse") ? "block" : "none";
        document.getElementById("colSchoepfer").style.display = (f === "all" || f === "schoepfer") ? "block" : "none";
        document.getElementById("colQc").style.display = (f === "all" || f === "qc") ? "block" : "none";
      });
    });

    refreshOrders();
    refreshSlow();
    setInterval(refreshOrders, 2000);
    setInterval(refreshSlow, 10000);
    setInterval(renderStations, 20000);
  </script>
</body>
</html>`;
}

export function renderCrewLoginPageHtml(): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>HOLY BASIL · Crew Login</title>
  <link rel="icon" href="/assets/holy_basil_logo_v7_team_stacked_sticker.svg" type="image/svg+xml">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #0A0C0A; color: #F5F7F5; font-family: system-ui, sans-serif; padding: 1rem;
    }
    .card {
      width: 100%; max-width: 360px; background: #121814; border: 2px solid rgba(82, 196, 90, 0.45);
      border-radius: 20px; padding: 1.75rem; text-align: center;
    }
    img { width: 84px; height: 84px; }
    h1 { font-size: 1.3rem; margin: 0.75rem 0 0.25rem 0; }
    p { color: #9FB0A2; font-size: 0.9rem; margin: 0 0 1.1rem 0; }
    input {
      width: 100%; padding: 0.9rem; border-radius: 12px; border: 1.5px solid rgba(82, 196, 90, 0.5);
      background: #0A0D0B; color: #F5F7F5; font-size: 1.4rem; text-align: center; letter-spacing: 0.3em;
    }
    button {
      width: 100%; margin-top: 0.9rem; padding: 0.9rem; border-radius: 12px; border: 0;
      background: #52C45A; color: #071209; font-weight: 800; font-size: 1rem; cursor: pointer;
    }
    button:disabled { opacity: 0.6; cursor: wait; }
    #msg { min-height: 1.3rem; margin-top: 0.7rem; color: #FF8A80; font-size: 0.88rem; }
  </style>
</head>
<body>
  <form class="card" id="loginForm" autocomplete="off">
    <img src="/assets/holy_basil_logo_v7_team_stacked_sticker.svg" alt="Holy Basil">
    <h1>Crew Login</h1>
    <p>KDS und Admin sind nur für die Crew.</p>
    <label for="pin" style="position:absolute;left:-9999px;">Crew-PIN</label>
    <input id="pin" name="pin" type="password" inputmode="numeric" placeholder="PIN" required autofocus>
    <button type="submit" id="loginBtn">Anmelden</button>
    <div id="msg" role="alert"></div>
  </form>
  <script>
    document.getElementById("loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("loginBtn");
      const msg = document.getElementById("msg");
      btn.disabled = true;
      msg.textContent = "";
      try {
        const res = await fetch("/api/crew/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: document.getElementById("pin").value })
        });
        const json = await res.json();
        if (json.success) {
          window.location.reload();
          return;
        }
        msg.textContent = (json.error && json.error.message) || "Anmeldung fehlgeschlagen.";
      } catch {
        msg.textContent = "Keine Verbindung zum Server.";
      }
      btn.disabled = false;
    });
  </script>
</body>
</html>`;
}
