export function renderAdminPageHtml(): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HOLY BASIL · Foodtruck Operations, KDS & Admin</title>
  <link rel="icon" href="/assets/holy_basil_logo_v7_team_stacked_sticker.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0A0C0A;
      --surface: #121814;
      --surface-2: #1A231C;
      --green-deep: #1B4D2E;
      --green-core: #2E7D32;
      --green-neon: #52C45A;
      --gold: #FFD54F;
      --chili: #E53935;
      --ink: #F5F7F5;
      --muted: #9FB0A2;
      --font-display: "Space Grotesk", system-ui, sans-serif;
      --font-body: "Plus Jakarta Sans", system-ui, sans-serif;
      --font-mono: "JetBrains Mono", monospace;
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
  </style>
</head>
<body>

  <header class="header">
    <a class="brand" href="/">
      <img src="/assets/holy_basil_logo_v7_team_stacked_sticker.svg" alt="Holy Basil">
      <span>HOLY BASIL · FOODTRUCK OPERATIONS &amp; ADMIN</span>
    </a>
    <div class="nav-pills">
      <button type="button" class="tab-btn active" data-filter="all">Alle Stationen (Live Pipeline)</button>
      <button type="button" class="tab-btn" data-filter="kasse">1. Kasse (Bar &amp; Freigabe)</button>
      <button type="button" class="tab-btn" data-filter="wok">2. Wok Demand (Koch)</button>
      <button type="button" class="tab-btn" data-filter="schoepfer">3. Schöpfer</button>
      <button type="button" class="tab-btn" data-filter="qc">4. QC &amp; Drinks</button>
      <a href="/order" class="tab-btn" style="text-decoration: none; color: var(--gold);">+ Gast-Bestellung</a>
      <a href="/board" class="tab-btn" style="text-decoration: none; color: var(--green-neon);">TV Pickup Board</a>
      <button type="button" class="tab-btn" id="btnLogout">Abmelden</button>
    </div>
  </header>

  <main class="main-wrap">
    <div id="connectionState" style="color: #FF8A80; font-family: var(--font-mono); font-size: 0.85rem;"></div>
    <div id="demoBanner" style="display: none; margin-bottom: 0.9rem; padding: 0.6rem 0.9rem; border-radius: 10px; border: 1.5px solid var(--gold); color: var(--gold); font-size: 0.85rem;">
      DEMO-MODUS: TWINT und Karte sind simuliert. Es fliesst kein Geld.
    </div>

    <!-- STATION 2: ZERO-CLICK WOK DEMAND COCKPIT FOR THE COOK -->
    <section class="wok-cockpit-bar" id="wokCockpitSection">
      <div class="wok-header-row">
        <div>
          <span style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--gold); font-weight: 700;">
            🔥 STATION 2 · ZERO-CLICK WOK DEMAND MANAGEMENT (FÜR DEN KOCH)
          </span>
          <h2 style="font-family: var(--font-display); font-size: 1.4rem; margin: 0.2rem 0 0 0;">
            Aktueller Pfannen-Bedarf (Nur bezahlte, noch nicht geschöpfte Portionen)
          </h2>
        </div>
        <div id="demoTools" style="display: none; gap: 0.65rem; align-items: center;">
          <button type="button" class="tab-btn" id="btnSeedDemoOrder" style="border-color: var(--gold); color: var(--gold);">
            ⚡ Test-Bestellung erzeugen
          </button>
          <button type="button" class="tab-btn" id="btnSimulatePaymentFallback" style="border-color: var(--chili); color: #FF8A80;">
            ⚠️ Zahlungs-Fallback testen
          </button>
        </div>
      </div>

      <div class="wok-grid">
        <div class="wok-pan-card">
          <div class="wok-pan-label">🍗 HOLY CHICKEN</div>
          <div class="wok-pan-count" id="wokChickenCount">0</div>
          <div class="wok-spice-breakdown" id="wokChickenSpice">Pfanne bereit</div>
        </div>
        <div class="wok-pan-card">
          <div class="wok-pan-label">🌱 HOLY VEGAN</div>
          <div class="wok-pan-count" id="wokVeganCount">0</div>
          <div class="wok-spice-breakdown" id="wokVeganSpice">Pfanne bereit</div>
        </div>
        <div class="wok-pan-card">
          <div class="wok-pan-label">🥩 PORK / MIX</div>
          <div class="wok-pan-count" id="wokPorkCount">0</div>
          <div class="wok-spice-breakdown" id="wokPorkSpice">Pfanne bereit</div>
        </div>
        <div class="wok-pan-card wok-pan-card--egg">
          <div class="wok-pan-label">🍳 KAI DAO EIER</div>
          <div class="wok-pan-count" id="wokEggCount">0</div>
          <div class="wok-spice-breakdown">Im Wok knusprig ausbacken</div>
        </div>
      </div>
    </section>

    <!-- 3 INTERACTIVE CREW STATIONS: KASSE -> SCHÖPFER -> QC & DRINKS -->
    <section class="stations-grid" id="stationsGrid">
      <!-- STATION 1: KASSE (CASHIER & MANUAL PAYMENT FALLBACK) -->
      <div class="station-col" id="colKasse">
        <div class="station-col__title">
          <span>💵 1. Kasse &amp; Zahlungsfreigabe</span>
          <span style="font-family: var(--font-mono); color: var(--gold);" id="countKasse">0</span>
        </div>
        <div class="station-col__sub">
          Kunde zahlt bar am Truck oder manuelle Klärung -> 1 Tap schickt Bestellung in den Wok
        </div>
        <div id="listKasse"></div>
      </div>

      <!-- STATION 3: SCHÖPFER (ASSEMBLY / PLATING) -->
      <div class="station-col" id="colSchoepfer">
        <div class="station-col__title">
          <span>🍱 3. Schöpfer (Boxen packen)</span>
          <span style="font-family: var(--font-mono); color: var(--green-neon);" id="countSchoepfer">0</span>
        </div>
        <div class="station-col__sub">
          Duftreis, gebratenes Krapao aus dem Wok &amp; Kai Dao Spiegelei in Boxen anrichten
        </div>
        <div id="listSchoepfer"></div>
      </div>

      <!-- STATION 4: QUALITÄTSKONTROLLE & DRINKS (QC & HANDOUT) -->
      <div class="station-col" id="colQc">
        <div class="station-col__title">
          <span>🔔 4. Qualitätskontrolle &amp; Drinks</span>
          <span style="font-family: var(--font-mono); color: var(--green-neon);" id="countQc">0</span>
        </div>
        <div class="station-col__sub">
          Boxen prüfen, bestellte Getränke dazustellen, Züri-Code aufrufen &amp; übergeben
        </div>
        <div id="listQc"></div>
      </div>
    </section>

    <!-- ADMIN, FEATURE TOGGLE & NFR SLA TELEMETRY -->
    <section class="admin-panel-grid">
      <div class="station-col" style="min-height: auto;">
        <div class="station-col__title">
          <span>⚙️ Feature Toggle &amp; Foodtruck Settings</span>
        </div>
        <div class="station-col__sub">
          Steuerung der Schärfegrad-Auswahl für den Bestellprozess
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; background: #0B100C; padding: 1rem; border-radius: 12px; border: 1.5px solid rgba(82, 196, 90, 0.35);">
          <div>
            <div style="font-weight: 700;">Individuelle Schärfegrade erlauben</div>
            <div style="font-size: 0.8rem; color: var(--muted);" id="spiceToggleStatusText">
              Aktuell: AUS (Nur Standardschärfe: leicht scharf 🌶️)
            </div>
          </div>
          <button type="button" class="tab-btn active" id="btnToggleSpiceFeature">
            Toggle umschalten
          </button>
        </div>

        <div style="margin-top: 1rem; font-weight: 700;">Truck-Standort heute</div>
        <div style="font-size: 0.8rem; color: var(--muted); margin-bottom: 0.5rem;">
          Steuert «Heute live» auf der Landingpage.
        </div>
        <div id="locationButtons" style="display: flex; flex-wrap: wrap; gap: 0.45rem;"></div>
      </div>

      <div class="station-col" style="min-height: auto;">
        <div class="station-col__title">
          <span>🛡️ Non-Functional Requirements (SLA &amp; Health)</span>
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
    const DRINK_LABELS = { thai_iced_tea: "🧋 Thai Iced Tea", coconut_water: "🥥 Kokoswasser", zueri_mate: "⚡ Züri Mate" };
    const SPICE_TEXT = { mild: "mild", leicht_scharf: "leicht scharf", original_thai_spicy: "Thai Spicy", extra_hot: "Extra Hot" };

    let currentCustomSpice = false;
    let busy = false;
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
    function showToast(message) {
      const el = document.getElementById("toast");
      el.textContent = message;
      el.style.display = "block";
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { el.style.display = "none"; }, 5000);
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
      return json.data;
    }

    function formatSpiceBreakdown(batch, customEnabled) {
      if (batch.totalPortions === 0) return "Pfanne frei";
      if (!customEnabled) return batch.totalPortions + "x Standardschärfe (leicht scharf 🌶️)";
      const parts = [];
      if (batch.bySpice.mild) parts.push(batch.bySpice.mild + "x Mild");
      if (batch.bySpice.leicht_scharf) parts.push(batch.bySpice.leicht_scharf + "x Leicht scharf");
      if (batch.bySpice.original_thai_spicy) parts.push(batch.bySpice.original_thai_spicy + "x Thai Spicy 🔥");
      if (batch.bySpice.extra_hot) parts.push(batch.bySpice.extra_hot + "x Extra Hot 🔥🔥");
      return parts.join(" · ");
    }

    function renderPortionSummary(order) {
      return order.portions.map((p) =>
        '<div style="font-size: 0.85rem; margin-top: 0.25rem;">• Box #' + esc(p.portionIndex) + ': <strong>' +
        esc(VARIANT_LABELS[p.variant] || p.variant) + '</strong>' +
        (p.addKaiDao ? '<span style="color:var(--gold);font-weight:700;"> + Kai Dao 🍳</span>' : '') +
        ' <span style="color:var(--muted);font-size:0.76rem;">(' + esc(SPICE_TEXT[p.spiceLevel] || p.spiceLevel) + ')</span></div>'
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
        (status ? ' data-status="' + status + '"' : '') + '>' + label + '</button>';
    }

    function renderKasse(orders) {
      if (orders.length === 0) return '<div style="color:var(--muted);font-size:0.85rem;">Keine offenen Zahlungen an der Kasse.</div>';
      return orders.map((o) => {
        const isError = o.status === "payment_error_fallback";
        return '<div class="order-ticket ' + (isError ? 'order-ticket--error' : 'order-ticket--cash') + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span class="order-code">' + esc(o.zueriCode.formatted) + '</span>' +
            '<strong style="font-family:var(--font-mono);font-size:1.05rem;">CHF ' + chf(o.totalChf) + '</strong>' +
          '</div>' +
          '<div style="font-size:0.78rem;color:var(--gold);margin-top:0.2rem;">' +
            (isError ? '⚠️ ZAHLUNG NICHT BESTÄTIGT: an der Kasse klären' : '💵 BARZAHLUNG AM TRUCK (offen)') +
          '</div>' +
          renderPortionSummary(o) +
          actionBtn('action-btn--cash', 'confirm_cash', o.id, '✓ CHF ' + chf(o.totalChf) + ' kassiert · In den Wok freigeben') +
          actionBtn('action-btn--ghost', 'cancel', o.id, 'Stornieren (nicht bezahlt)') +
        '</div>';
      }).join("");
    }

    function renderSchoepfer(orders) {
      if (orders.length === 0) return '<div style="color:var(--muted);font-size:0.85rem;">Keine Boxen zum Schöpfen offen.</div>';
      return orders.map((o) =>
        '<div class="order-ticket">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span class="order-code">' + esc(o.zueriCode.formatted) + '</span>' +
            '<span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--green-neon);">' + esc(o.totalPortions) + ' Box(en) · Bezahlt</span>' +
          '</div>' +
          renderPortionSummary(o) +
          actionBtn('action-btn--plate', 'advance', o.id, '🍱 Boxen geschöpft · Weiter an QC &amp; Drinks', 'plating') +
        '</div>'
      ).join("");
    }

    function renderQc(orders) {
      if (orders.length === 0) return '<div style="color:var(--muted);font-size:0.85rem;">Keine Bestellungen in der QC / Ausgabe.</div>';
      return orders.map((o) => {
        const ready = o.status === "ready";
        return '<div class="order-ticket" style="' + (ready ? 'border-color:var(--gold);background:#142418;' : '') + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span class="order-code">' + esc(o.zueriCode.formatted) + '</span>' +
            '<span style="font-family:var(--font-mono);font-size:0.78rem;color:' + (ready ? 'var(--gold)' : 'var(--ink)') + ';">' +
              (ready ? '🔔 AUFGERUFEN' : 'QC PRÜFUNG') +
            '</span>' +
          '</div>' +
          renderPortionSummary(o) +
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

    async function refreshDashboard() {
      if (busy) return;
      try {
        const [ordData, health, locData] = await Promise.all([
          api("/api/orders"),
          api("/api/health"),
          api("/api/locations")
        ]);

        const orders = ordData.orders;
        const wokDemand = ordData.wokDemand;
        currentCustomSpice = wokDemand.customSpiceEnabled;

        setText("wokChickenCount", String(wokDemand.batches.chicken.totalPortions));
        setText("wokChickenSpice", formatSpiceBreakdown(wokDemand.batches.chicken, currentCustomSpice));
        setText("wokVeganCount", String(wokDemand.batches.vegan.totalPortions));
        setText("wokVeganSpice", formatSpiceBreakdown(wokDemand.batches.vegan, currentCustomSpice));
        setText("wokPorkCount", String(wokDemand.batches.pork_mix.totalPortions));
        setText("wokPorkSpice", formatSpiceBreakdown(wokDemand.batches.pork_mix, currentCustomSpice));
        setText("wokEggCount", String(wokDemand.totalKaiDaoEggs));

        // Oldest first: the crew works the queue top to bottom.
        const queue = orders.slice().reverse();
        const kasse = queue.filter((o) => o.status === "pending_cash" || o.status === "payment_error_fallback");
        const schoepfer = queue.filter((o) => o.status === "received" || o.status === "in_wok");
        const qc = queue.filter((o) => o.status === "plating" || o.status === "ready");

        setText("countKasse", String(kasse.length));
        setHtml("listKasse", renderKasse(kasse));
        setText("countSchoepfer", String(schoepfer.length));
        setHtml("listSchoepfer", renderSchoepfer(schoepfer));
        setText("countQc", String(qc.length));
        setHtml("listQc", renderQc(qc));

        document.getElementById("demoTools").style.display = ordData.demoPayments ? "flex" : "none";
        document.getElementById("demoBanner").style.display = ordData.demoPayments ? "block" : "none";

        setText("spiceToggleStatusText", currentCustomSpice
          ? "Aktuell: AKTIV (Gäste wählen Mild / Leicht scharf / Thai Spicy / Extra Hot)"
          : "Aktuell: AUS (Nur Standardschärfe: leicht scharf 🌶️ für maximalen Wok-Speed)");
        setText("slaPayment", health.metrics.paymentAttempts > 0 ? health.metrics.paymentReliabilityRate.toFixed(1) + "%" : "–");
        setText("slaLatency", health.metrics.avgLatencyMs + " ms");
        setText("slaAvail", health.metrics.availabilityRate.toFixed(2) + "%");

        setHtml("locationButtons", renderLocations(locData));
        setText("connectionState", "");
      } catch (err) {
        setText("connectionState", "⚠️ Keine Verbindung zum Server. Anzeige ist evtl. veraltet.");
      }
    }

    async function runAction(fn) {
      if (busy) return;
      busy = true;
      try {
        await fn();
      } catch (err) {
        showToast("Nicht ausgeführt: " + (err && err.message ? err.message : "Fehler"));
      } finally {
        busy = false;
        refreshDashboard();
      }
    }

    // One listener for all order buttons (event delegation), independent of re-renders.
    document.getElementById("stationsGrid").addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      btn.disabled = true;

      if (action === "confirm_cash") {
        runAction(() => api("/api/orders/" + encodeURIComponent(id), "PATCH", { action: "confirm_cash", note: "An Kasse bestätigt" }));
      } else if (action === "cancel") {
        runAction(() => api("/api/orders/" + encodeURIComponent(id), "PATCH", { status: "cancelled", note: "An Kasse storniert" }));
      } else if (action === "advance") {
        runAction(() => api("/api/orders/" + encodeURIComponent(id), "PATCH", { status: btn.getAttribute("data-status") }));
      }
    });

    document.getElementById("locationButtons").addEventListener("click", (event) => {
      const btn = event.target.closest("[data-location]");
      if (!btn) return;
      const id = btn.getAttribute("data-location");
      runAction(() => api("/api/locations", "PATCH", { locationId: id || null }));
    });

    document.getElementById("btnToggleSpiceFeature").addEventListener("click", () => {
      runAction(() => api("/api/features", "PATCH", { enableCustomSpiceLevels: !currentCustomSpice }));
    });

    document.getElementById("btnSeedDemoOrder").addEventListener("click", () => {
      runAction(() => api("/api/orders", "POST", {
        portions: [
          { variant: "chicken", addKaiDao: true },
          { variant: "vegan", addKaiDao: false }
        ],
        drinks: [{ drinkId: "thai_iced_tea", quantity: 2 }],
        paymentMethod: "cash"
      }));
    });

    document.getElementById("btnSimulatePaymentFallback").addEventListener("click", () => {
      runAction(() => api("/api/orders", "POST", {
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

    refreshDashboard();
    setInterval(refreshDashboard, 2000);
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
