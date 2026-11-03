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
    </div>
  </header>

  <main class="main-wrap">

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
        <div style="display: flex; gap: 0.65rem; align-items: center;">
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
      </div>

      <div class="station-col" style="min-height: auto;">
        <div class="station-col__title">
          <span>🛡️ Non-Functional Requirements (SLA &amp; Health)</span>
        </div>
        <div class="station-col__sub">
          Echtzeit-Überwachung: 99.99% Payment Reliability · &lt; 1000ms Latenz · 99.5% API Uptime
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
          <div class="metric-box">
            <div style="font-size: 0.75rem; color: var(--muted);">Payment Zero-Loss</div>
            <div class="metric-val" id="slaPayment">100%</div>
          </div>
          <div class="metric-box">
            <div style="font-size: 0.75rem; color: var(--muted);">Ø API Latenz (&lt;1s)</div>
            <div class="metric-val" id="slaLatency">4 ms</div>
          </div>
          <div class="metric-box">
            <div style="font-size: 0.75rem; color: var(--muted);">API Availability</div>
            <div class="metric-val" id="slaAvail">100%</div>
          </div>
        </div>
      </div>
    </section>

  </main>

  <script>
    const VARIANT_LABELS = { vegan: "🌱 Holy Vegan", chicken: "🍗 Holy Chicken", pork_mix: "🥩 Holy Pork/Mix" };
    const DRINK_LABELS = { thai_iced_tea: "🧋 Thai Iced Tea", coconut_water: "🥥 Kokoswasser", zueri_mate: "⚡ Züri Mate" };

    let currentCustomSpice = false;

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
        \`<div style="font-size: 0.85rem; margin-top: 0.25rem;">
          • Box #\${p.portionIndex}: <strong>\${VARIANT_LABELS[p.variant] || p.variant}</strong>
          \${p.addKaiDao ? '<span style="color:var(--gold);font-weight:700;"> + Kai Dao 🍳</span>' : ''}
          <span style="color:var(--muted);font-size:0.76rem;">(\${p.spiceLevel.replace(/_/g, " ")})</span>
        </div>\`
      ).join("");
    }

    function renderDrinkSummary(order) {
      if (!order.drinks || order.drinks.length === 0) {
        return '<div style="font-size: 0.78rem; color: var(--muted); margin-top: 0.4rem;">Keine Getränke</div>';
      }
      return '<div style="margin-top: 0.5rem; padding: 0.45rem 0.65rem; border-radius: 8px; background: rgba(255, 213, 79, 0.15); border: 1px solid var(--gold); color: var(--gold); font-size: 0.82rem; font-weight: 700;">' +
        '🥤 GETRÄNKE RICHTEN: ' + order.drinks.map((d) => d.quantity + "x " + (DRINK_LABELS[d.drinkId] || d.drinkId)).join(", ") +
        '</div>';
    }

    async function refreshDashboard() {
      try {
        const [ordRes, healthRes] = await Promise.all([
          fetch("/api/orders"),
          fetch("/api/health")
        ]);
        const ordJson = await ordRes.json();
        const healthJson = await healthRes.json();

        if (ordJson.success) {
          const { orders, wokDemand } = ordJson.data;
          currentCustomSpice = wokDemand.customSpiceEnabled;

          // Update Wok Cockpit
          document.getElementById("wokChickenCount").textContent = String(wokDemand.batches.chicken.totalPortions);
          document.getElementById("wokChickenSpice").textContent = formatSpiceBreakdown(wokDemand.batches.chicken, currentCustomSpice);

          document.getElementById("wokVeganCount").textContent = String(wokDemand.batches.vegan.totalPortions);
          document.getElementById("wokVeganSpice").textContent = formatSpiceBreakdown(wokDemand.batches.vegan, currentCustomSpice);

          document.getElementById("wokPorkCount").textContent = String(wokDemand.batches.pork_mix.totalPortions);
          document.getElementById("wokPorkSpice").textContent = formatSpiceBreakdown(wokDemand.batches.pork_mix, currentCustomSpice);

          document.getElementById("wokEggCount").textContent = String(wokDemand.totalKaiDaoEggs);

          // Station 1: Kasse (pending_cash or payment_error_fallback)
          const kasseOrders = orders.filter((o) => o.status === "pending_cash" || o.status === "payment_error_fallback");
          document.getElementById("countKasse").textContent = String(kasseOrders.length);
          document.getElementById("listKasse").innerHTML = kasseOrders.length === 0
            ? '<div style="color:var(--muted);font-size:0.85rem;">Keine offenen Barzahlungen an der Kasse.</div>'
            : kasseOrders.map((o) => \`
              <div class="order-ticket \${o.status === 'payment_error_fallback' ? 'order-ticket--error' : 'order-ticket--cash'}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span class="order-code">\${o.zueriCode.formatted}</span>
                  <strong style="font-family:var(--font-mono);font-size:1.05rem;">CHF \${o.totalChf.toFixed(2)}</strong>
                </div>
                <div style="font-size:0.78rem;color:var(--gold);margin-top:0.2rem;">
                  \${o.status === 'payment_error_fallback' ? '⚠️ ZAHLUNGS-FALLBACK: Manuell prüfen!' : '💵 BARZAHLUNG AM TRUCK (Pending)'}
                </div>
                \${renderPortionSummary(o)}
                <button type="button" class="action-btn action-btn--cash" data-action="confirm_cash" data-id="\${o.id}">
                  ✓ CHF \${o.totalChf.toFixed(2)} verbucht · In den Wok freigeben
                </button>
              </div>
            \`).join("");

          // Station 3: Schöpfer (received or in_wok)
          const schoepferOrders = orders.filter((o) => o.status === "received" || o.status === "in_wok");
          document.getElementById("countSchoepfer").textContent = String(schoepferOrders.length);
          document.getElementById("listSchoepfer").innerHTML = schoepferOrders.length === 0
            ? '<div style="color:var(--muted);font-size:0.85rem;">Keine Boxen zum Schöpfen offen.</div>'
            : schoepferOrders.map((o) => \`
              <div class="order-ticket">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span class="order-code">\${o.zueriCode.formatted}</span>
                  <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--green-neon);">\${o.totalPortions} Box(en) · Bezahlt</span>
                </div>
                \${renderPortionSummary(o)}
                <button type="button" class="action-btn action-btn--plate" data-action="advance" data-status="plating" data-id="\${o.id}">
                  🍱 Boxen geschöpft · Weiter an QC &amp; Drinks
                </button>
              </div>
            \`).join("");

          // Station 4: QC & Drinks (plating or ready)
          const qcOrders = orders.filter((o) => o.status === "plating" || o.status === "ready");
          document.getElementById("countQc").textContent = String(qcOrders.length);
          document.getElementById("listQc").innerHTML = qcOrders.length === 0
            ? '<div style="color:var(--muted);font-size:0.85rem;">Keine Bestellungen in der QC / Ausgabe.</div>'
            : qcOrders.map((o) => \`
              <div class="order-ticket" style="\${o.status === 'ready' ? 'border-color:var(--gold);background:#142418;' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span class="order-code">\${o.zueriCode.formatted}</span>
                  <span style="font-family:var(--font-mono);font-size:0.78rem;color:\${o.status === 'ready' ? 'var(--gold)' : 'var(--ink)'};">
                    \${o.status === 'ready' ? '🔔 AUFGERUFEN' : 'QC PRÜFUNG'}
                  </span>
                </div>
                \${renderPortionSummary(o)}
                \${renderDrinkSummary(o)}
                \${o.status === "plating"
                  ? \`<button type="button" class="action-btn action-btn--qc" data-action="advance" data-status="ready" data-id="\${o.id}">
                      🔔 QC OK &amp; Drinks bereit · JETZT AUFRUFEN
                    </button>\`
                  : \`<button type="button" class="action-btn action-btn--done" data-action="advance" data-status="completed" data-id="\${o.id}">
                      ✓ An Gast übergeben (Abschliessen)
                    </button>\`
                }
              </div>
            \`).join("");

          bindOrderActionButtons();
        }

        if (healthJson.success) {
          const { metrics, features } = healthJson.data;
          currentCustomSpice = features.enableCustomSpiceLevels;
          document.getElementById("spiceToggleStatusText").textContent = currentCustomSpice
            ? "Aktuell: AKTIV (Kunden können Mild / Leicht scharf / Thai Spicy / Extra Hot wählen)"
            : "Aktuell: AUS (Nur Standardschärfe: leicht scharf 🌶️ für maximalen Wok-Speed)";
          document.getElementById("slaPayment").textContent = metrics.paymentReliabilityRate.toFixed(2) + "%";
          document.getElementById("slaLatency").textContent = metrics.avgLatencyMs + " ms";
          document.getElementById("slaAvail").textContent = metrics.availabilityRate.toFixed(2) + "%";
        }
      } catch {}
    }

    function bindOrderActionButtons() {
      document.querySelectorAll("[data-action='confirm_cash']").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          await fetch("/api/orders/" + id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "confirm_cash", note: "An Kasse bestätigt" })
          });
          refreshDashboard();
        });
      });

      document.querySelectorAll("[data-action='advance']").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          const status = btn.getAttribute("data-status");
          await fetch("/api/orders/" + id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
          });
          refreshDashboard();
        });
      });
    }

    document.getElementById("btnToggleSpiceFeature").addEventListener("click", async () => {
      await fetch("/api/features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableCustomSpiceLevels: !currentCustomSpice })
      });
      refreshDashboard();
    });

    document.getElementById("btnSeedDemoOrder").addEventListener("click", async () => {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portions: [
            { variant: "chicken", addKaiDao: true },
            { variant: "vegan", addKaiDao: false }
          ],
          drinks: [{ drinkId: "thai_iced_tea", quantity: 2 }],
          paymentMethod: "cash"
        })
      });
      refreshDashboard();
    });

    document.getElementById("btnSimulatePaymentFallback").addEventListener("click", async () => {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portions: [{ variant: "pork_mix", addKaiDao: true }],
          drinks: [{ drinkId: "coconut_water", quantity: 1 }],
          paymentMethod: "card",
          simulatePaymentFailure: true
        })
      });
      refreshDashboard();
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
