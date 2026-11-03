export function renderOrderPageHtml(): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>HOLY BASIL · Mobile QR-Bestellung & Züri-Code Ticket</title>
  <link rel="icon" href="/assets/holy_basil_logo_v7_team_stacked_sticker.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0A0C0A;
      --surface: #131914;
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
      -webkit-font-smoothing: antialiased;
      padding-bottom: 5rem;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 40;
      background: rgba(10, 12, 10, 0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1.5px solid rgba(82, 196, 90, 0.3);
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .topbar__brand {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      text-decoration: none;
      color: var(--ink);
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.05rem;
    }
    .topbar__brand img { width: 34px; height: 34px; }
    .topbar__links { display: flex; gap: 0.5rem; align-items: center; }
    .pill-link {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--ink);
      background: var(--surface-2);
      border: 1px solid rgba(82, 196, 90, 0.4);
      padding: 0.35rem 0.65rem;
      border-radius: 8px;
      text-decoration: none;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 1rem;
    }
    .hero-banner {
      background: linear-gradient(135deg, #162419 0%, #0E1510 100%);
      border: 2px solid var(--green-neon);
      border-radius: 20px;
      padding: 1.15rem;
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .hero-banner h1 {
      font-family: var(--font-display);
      font-size: 1.35rem;
      margin: 0.25rem 0;
    }
    .badge {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.22rem 0.55rem;
      border-radius: 6px;
      background: var(--green-deep);
      color: var(--ink);
      border: 1px solid var(--green-neon);
    }
    .badge--gold {
      background: rgba(255, 213, 79, 0.15);
      color: var(--gold);
      border-color: var(--gold);
    }
    .section-card {
      background: var(--surface);
      border: 1.5px solid rgba(82, 196, 90, 0.28);
      border-radius: 18px;
      padding: 1.15rem;
      margin-bottom: 1.1rem;
    }
    .section-title {
      font-family: var(--font-display);
      font-size: 1.1rem;
      margin: 0 0 0.75rem 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    /* Portion Stepper (1..10) */
    .stepper-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--surface-2);
      padding: 0.75rem 1rem;
      border-radius: 14px;
      border: 1px solid rgba(82, 196, 90, 0.35);
    }
    .stepper-controls {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .step-btn {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      border: 2px solid var(--green-neon);
      background: #0F1711;
      color: var(--ink);
      font-family: var(--font-mono);
      font-size: 1.25rem;
      font-weight: 800;
      cursor: pointer;
    }
    .step-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .step-count {
      font-family: var(--font-mono);
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--gold);
      min-width: 2.2rem;
      text-align: center;
    }
    .mode-switch {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    .mode-btn {
      flex: 1;
      padding: 0.55rem;
      border-radius: 10px;
      border: 1.5px solid rgba(82, 196, 90, 0.3);
      background: #0D120E;
      color: var(--muted);
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
    }
    .mode-btn.active {
      background: var(--green-deep);
      color: var(--ink);
      border-color: var(--green-neon);
    }
    /* Variant Cards */
    .variant-grid {
      display: grid;
      gap: 0.65rem;
    }
    .variant-btn {
      width: 100%;
      text-align: left;
      background: #0E1410;
      border: 2px solid rgba(82, 196, 90, 0.25);
      border-radius: 14px;
      padding: 0.9rem 1rem;
      color: var(--ink);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: transform 0.12s ease, border-color 0.12s ease;
    }
    .variant-btn.selected {
      background: #17281B;
      border-color: var(--green-neon);
      box-shadow: 0 0 0 1px var(--green-neon);
    }
    .variant-name {
      font-family: var(--font-display);
      font-size: 1.05rem;
      font-weight: 800;
    }
    .variant-sub {
      font-size: 0.8rem;
      color: var(--muted);
      margin-top: 0.2rem;
    }
    .variant-price {
      font-family: var(--font-mono);
      font-weight: 800;
      font-size: 1.05rem;
      color: var(--gold);
      flex-shrink: 0;
      margin-left: 0.75rem;
    }
    .kaidao-toggle {
      margin-top: 0.75rem;
      width: 100%;
      padding: 0.8rem 1rem;
      border-radius: 12px;
      border: 2px dashed var(--gold);
      background: rgba(255, 213, 79, 0.08);
      color: var(--ink);
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      font-weight: 700;
    }
    .kaidao-toggle.checked {
      border-style: solid;
      background: rgba(255, 213, 79, 0.2);
    }
    .portion-box-card {
      background: #0D130F;
      border: 1px solid rgba(82, 196, 90, 0.3);
      border-radius: 14px;
      padding: 0.85rem;
      margin-bottom: 0.75rem;
    }
    .spice-banner {
      background: #142017;
      border: 1px solid rgba(82, 196, 90, 0.45);
      border-radius: 12px;
      padding: 0.75rem 0.9rem;
      font-size: 0.85rem;
      color: var(--ink);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .spice-select {
      width: 100%;
      padding: 0.65rem;
      border-radius: 10px;
      background: #0B100C;
      color: var(--ink);
      border: 1.5px solid var(--green-neon);
      font-family: var(--font-body);
      font-weight: 600;
      margin-top: 0.5rem;
    }
    .drink-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.65rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .drink-row:last-child { border-bottom: 0; }
    .pay-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.6rem;
    }
    .pay-btn {
      padding: 0.85rem 0.5rem;
      border-radius: 12px;
      border: 2px solid rgba(82, 196, 90, 0.3);
      background: #0E1410;
      color: var(--ink);
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 0.88rem;
      cursor: pointer;
      text-align: center;
    }
    .pay-btn.selected {
      background: var(--green-deep);
      border-color: var(--green-neon);
    }
    .submit-btn {
      width: 100%;
      padding: 1.1rem;
      border-radius: 16px;
      border: 0;
      background: var(--green-neon);
      color: #061108;
      font-family: var(--font-display);
      font-size: 1.15rem;
      font-weight: 800;
      cursor: pointer;
      margin-top: 0.5rem;
      box-shadow: 0 10px 24px rgba(82, 196, 90, 0.3);
    }
    /* LIVE ZÜRI-CODE BOARDING PASS TICKET */
    .ticket-card {
      background: #101712;
      border: 3px solid var(--green-neon);
      border-radius: 24px;
      padding: 1.5rem;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85);
    }
    .ticket-card.is-ready {
      background: #132A18;
      border-color: var(--gold);
      animation: pulseGlow 1.6s infinite alternate;
    }
    @keyframes pulseGlow {
      from { box-shadow: 0 0 15px rgba(82, 196, 90, 0.4); }
      to { box-shadow: 0 0 40px rgba(255, 213, 79, 0.85); }
    }
    .ticket-plz {
      font-family: var(--font-mono);
      font-size: 4rem;
      font-weight: 800;
      color: var(--gold);
      line-height: 1;
      margin: 0.4rem 0 0.15rem 0;
    }
    .ticket-quarter {
      font-family: var(--font-display);
      font-size: 1.65rem;
      font-weight: 800;
      color: var(--ink);
      letter-spacing: 0.05em;
    }
    .status-steps {
      margin: 1.4rem 0;
      text-align: left;
      display: grid;
      gap: 0.55rem;
    }
    .status-step {
      padding: 0.7rem 0.95rem;
      border-radius: 12px;
      background: #0B100C;
      border: 1.5px solid rgba(255,255,255,0.1);
      font-size: 0.88rem;
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .status-step.active {
      background: var(--green-deep);
      border-color: var(--green-neon);
      color: var(--ink);
      font-weight: 700;
    }
    .status-step.cash-wait {
      background: rgba(255, 213, 79, 0.16);
      border-color: var(--gold);
      color: var(--gold);
      font-weight: 700;
    }
    .status-step.error-wait {
      background: rgba(229, 57, 53, 0.2);
      border-color: var(--chili);
      color: #FFCDD2;
      font-weight: 700;
    }
  </style>
</head>
<body>

  <header class="topbar">
    <a class="topbar__brand" href="/">
      <img src="/assets/holy_basil_logo_v7_team_stacked_sticker.svg" alt="Holy Basil">
      <span>HOLY BASIL ORDER</span>
    </a>
    <div class="topbar__links">
      <a class="pill-link" href="/board">Pickup Board</a>
      <a class="pill-link" href="/admin">Crew KDS</a>
    </div>
  </header>

  <main class="container">
    <!-- ORDER CONFIGURATOR VIEW -->
    <div id="orderBuilderView">
      <div class="hero-banner">
        <div>
          <span class="badge">100% VEGANE SAUCENBASIS</span>
          <h1>Frisches Pad Krapao bestellen</h1>
          <div style="font-size: 0.83rem; color: var(--muted);">Bis zu 10 Portionen · Sofortiger Züri-Code für die Abholung</div>
        </div>
        <img src="/assets/holy_basil_logo_v7_team_stacked_sticker.svg" width="64" height="72" alt="Holy Basil">
      </div>

      <!-- STEP 1: PORTIONS COUNT (1..10) -->
      <section class="section-card">
        <div class="section-title">
          <span>1. Anzahl Portionen (Max. 10)</span>
          <span class="badge badge--gold" id="portionBadge">1 Portion</span>
        </div>
        <div class="stepper-row">
          <div>
            <div style="font-weight: 700;">Wie viele Boxen Pad Krapao?</div>
            <div style="font-size: 0.78rem; color: var(--muted);">Für dich allein oder dein ganzes Team</div>
          </div>
          <div class="stepper-controls">
            <button type="button" class="step-btn" id="btnDecPortion" aria-label="Portion reduzieren">−</button>
            <span class="step-count" id="portionCountDisplay">1</span>
            <button type="button" class="step-btn" id="btnIncPortion" aria-label="Portion erhöhen">+</button>
          </div>
        </div>

        <div class="mode-switch" id="groupModeSwitch" style="display: none;">
          <button type="button" class="mode-btn active" id="modeExpressBtn">Alle Portionen gleich (Express)</button>
          <button type="button" class="mode-btn" id="modeCustomBtn">Jede Portion einzeln anpassen</button>
        </div>
      </section>

      <!-- STEP 2: VARIANT & KAI DAO SELECTION -->
      <section class="section-card">
        <div class="section-title">
          <span>2. Variante &amp; Spiegelei (Kai Dao)</span>
        </div>

        <!-- Express Single Configuration -->
        <div id="expressBuilder">
          <div class="variant-grid" id="expressVariantGrid">
            <button type="button" class="variant-btn selected" data-variant="chicken">
              <div>
                <div class="variant-name">🍗 HOLY CHICKEN</div>
                <div class="variant-sub">Fein gehacktes Schweizer Poulet · Bestseller</div>
              </div>
              <div class="variant-price">CHF 14.00</div>
            </button>
            <button type="button" class="variant-btn" data-variant="vegan">
              <div>
                <div class="variant-name">🌱 HOLY VEGAN</div>
                <div class="variant-sub">100% Plant-Based Soja- &amp; Pilz-Mince</div>
              </div>
              <div class="variant-price">CHF 12.00</div>
            </button>
            <button type="button" class="variant-btn" data-variant="pork_mix">
              <div>
                <div class="variant-name">🥩 HOLY PORK / MIX</div>
                <div class="variant-sub">Kräftiger Schwein-Rind-Mix aus dem Wok</div>
              </div>
              <div class="variant-price">CHF 15.00</div>
            </button>
          </div>

          <button type="button" class="kaidao-toggle checked" id="expressKaiDaoBtn">
            <span>🍳 + Original Kai Dao (Knuspriges Thai-Spiegelei)</span>
            <span style="font-family: var(--font-mono); color: var(--gold);">+ CHF 2.50</span>
          </button>
        </div>

        <!-- Individual Multi-Portion Builder (1..10) -->
        <div id="customBuilder" style="display: none;"></div>

        <!-- Spice Level Banner / Feature Toggle -->
        <div style="margin-top: 0.9rem;" id="spiceSection">
          <div class="spice-banner" id="standardSpiceBanner">
            <span>🌶️ <strong>Standardschärfe:</strong> Leicht scharf (perfekt ausbalanciert)</span>
            <span class="badge">STANDARD</span>
          </div>
          <div id="customSpiceContainer" style="display: none;">
            <label for="customSpiceSelect" style="font-size: 0.82rem; font-weight: 700;">Schärfegrad wählen (Feature Toggle Aktiv):</label>
            <select id="customSpiceSelect" class="spice-select">
              <option value="leicht_scharf">🌶️ Standardschärfe (Leicht scharf)</option>
              <option value="mild">🌱 Mild (Ohne frische Chilis)</option>
              <option value="original_thai_spicy">🔥🔥 Original Thai Spicy (Bird's Eye Chilis)</option>
              <option value="extra_hot">🔥🔥🔥 Bangkok Extra Hot</option>
            </select>
          </div>
        </div>
      </section>

      <!-- STEP 3: DRINKS (DURSTLÖSCHER) -->
      <section class="section-card">
        <div class="section-title">
          <span>3. Eiskalte Drinks dazu?</span>
          <span style="font-size: 0.78rem; color: var(--muted);">Wird bei der QC bereitgestellt</span>
        </div>
        <div class="drink-row">
          <div>
            <div style="font-weight: 700;">🧋 Hausgemachter Thai Iced Tea</div>
            <div style="font-size: 0.78rem; color: var(--muted);">100% vegan mit Hafer-Kokos-Creme · CHF 4.50</div>
          </div>
          <div class="stepper-controls">
            <button type="button" class="step-btn drink-dec" data-drink="thai_iced_tea">−</button>
            <span class="step-count drink-count" id="drink_thai_iced_tea">0</span>
            <button type="button" class="step-btn drink-inc" data-drink="thai_iced_tea">+</button>
          </div>
        </div>
        <div class="drink-row">
          <div>
            <div style="font-weight: 700;">🥥 Junges Thai Kokoswasser</div>
            <div style="font-size: 0.78rem; color: var(--muted);">100% Nam Hom Kokoswasser eiskalt · CHF 4.00</div>
          </div>
          <div class="stepper-controls">
            <button type="button" class="step-btn drink-dec" data-drink="coconut_water">−</button>
            <span class="step-count drink-count" id="drink_coconut_water">0</span>
            <button type="button" class="step-btn drink-inc" data-drink="coconut_water">+</button>
          </div>
        </div>
      </section>

      <!-- STEP 4: ZÜRI-CODE PREFERENCE & PAYMENT METHOD -->
      <section class="section-card">
        <div class="section-title">
          <span>4. Zahlungsart &amp; Züri-Code</span>
        </div>
        <div style="margin-bottom: 0.9rem;">
          <label for="prefPlzSelect" style="font-size: 0.82rem; font-weight: 600; color: var(--muted); display: block; margin-bottom: 0.35rem;">
            Wunsch-PLZ für deinen Abholcode (falls frei):
          </label>
          <select id="prefPlzSelect" class="spice-select" style="margin-top: 0;">
            <option value="">⚡ Automatisch freien Züri-Code zuweisen</option>
            <option value="8004">8004 · LANGSTRASSE (Chreis Cheib)</option>
            <option value="8005">8005 · ZÜRI WEST</option>
            <option value="8050">8050 · OERLIKON</option>
            <option value="8001">8001 · NIEDERDORF</option>
            <option value="8003">8003 · WIEDIKON</option>
            <option value="8048">8048 · ALTSTETTEN</option>
            <option value="8400">8400 · WINTI</option>
          </select>
        </div>

        <div class="pay-grid" id="paymentGrid">
          <button type="button" class="pay-btn selected" data-pay="twint">📱 TWINT</button>
          <button type="button" class="pay-btn" data-pay="card">💳 Karte / Apple Pay</button>
          <button type="button" class="pay-btn" data-pay="cash">💵 Bar am Truck</button>
        </div>

        <div id="cashInfoNote" style="display: none; margin-top: 0.75rem; padding: 0.7rem; border-radius: 10px; background: rgba(255, 213, 79, 0.12); border: 1px solid var(--gold); font-size: 0.82rem; color: var(--gold);">
          💡 <strong>Hinweis bei Barzahlung (Cash):</strong> Deine Bestellung erhält sofort einen Züri-Code im Status <em>Pending</em>. Bitte zahle kurz an der Foodtruck-Kasse, damit der Kassierer deine Bestellung für den Wok freigibt!
        </div>

        <button type="button" class="submit-btn" id="submitOrderBtn">
          Jetzt bestellen · <span id="totalPriceDisplay">CHF 16.50</span>
        </button>
        <div id="orderErrorMsg" style="color: #FF8A80; font-size: 0.85rem; margin-top: 0.5rem; text-align: center;"></div>
      </section>
    </div>

    <!-- LIVE ZÜRI-CODE BOARDING PASS TICKET VIEW -->
    <div id="liveTicketView" style="display: none;">
      <div class="ticket-card" id="ticketCardBox">
        <span class="badge" id="ticketTopBadge">DEIN LIVE ABHOL-TICKET</span>
        <div class="ticket-plz" id="ticketPlz">8004</div>
        <div class="ticket-quarter" id="ticketQuarter">LANGSTRASSE</div>
        <div style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--muted); margin-top: 0.35rem;" id="ticketMeta">
          Bestellung #ord_123 · CHF 16.50
        </div>

        <div id="ticketAlertBanner" style="margin-top: 1rem; padding: 0.85rem; border-radius: 12px; display: none;"></div>

        <div class="status-steps">
          <div class="status-step" id="stepCash">
            <span>1. Zahlung &amp; Kassen-Freigabe</span>
            <span id="stepCashIcon">⏳</span>
          </div>
          <div class="status-step" id="stepWok">
            <span>2. Frisch im heissen Wok 🔥</span>
            <span id="stepWokIcon">·</span>
          </div>
          <div class="status-step" id="stepPlating">
            <span>3. Schöpfen &amp; Qualitätskontrolle (inkl. Drinks) 🍱</span>
            <span id="stepPlatingIcon">·</span>
          </div>
          <div class="status-step" id="stepReady">
            <span>4. ABHOLBEREIT AM FOODTRUCK 🔔</span>
            <span id="stepReadyIcon">·</span>
          </div>
        </div>

        <div style="background: #0B100C; border-radius: 14px; padding: 0.9rem; text-align: left; font-size: 0.86rem;" id="ticketItemsList"></div>

        <div style="display: flex; gap: 0.6rem; margin-top: 1.2rem;">
          <button type="button" class="mode-btn active" id="newOrderBtn" style="padding: 0.8rem;">+ Weitere Bestellung aufgeben</button>
          <a href="/admin" class="mode-btn" style="padding: 0.8rem; text-align: center; text-decoration: none; color: var(--ink);">Crew KDS öffnen</a>
        </div>
      </div>
    </div>
  </main>

  <script>
    const PRICES = { vegan: 12.0, chicken: 14.0, pork_mix: 15.0, kaiDao: 2.5, thai_iced_tea: 4.5, coconut_water: 4.0 };
    const NAMES = { vegan: "Holy Vegan", chicken: "Holy Chicken", pork_mix: "Holy Pork / Mix" };

    let portionCount = 1;
    let builderMode = "express"; // 'express' | 'custom'
    let expressVariant = "chicken";
    let expressKaiDao = true;
    let customPortions = [{ variant: "chicken", addKaiDao: true }];
    let drinks = { thai_iced_tea: 0, coconut_water: 0 };
    let paymentMethod = "twint";
    let customSpiceEnabled = false;
    let activeOrderId = null;
    let pollTimer = null;

    // Check URL query params for preselected variant
    const urlParams = new URLSearchParams(window.location.search);
    const qVar = urlParams.get("variant");
    if (qVar && ["vegan", "chicken", "pork_mix"].includes(qVar)) {
      expressVariant = qVar;
      customPortions[0].variant = qVar;
    }

    async function loadFeatureFlags() {
      try {
        const res = await fetch("/api/features");
        const json = await res.json();
        if (json.success && json.data.features) {
          customSpiceEnabled = Boolean(json.data.features.enableCustomSpiceLevels);
          document.getElementById("standardSpiceBanner").style.display = customSpiceEnabled ? "none" : "flex";
          document.getElementById("customSpiceContainer").style.display = customSpiceEnabled ? "block" : "none";
        }
      } catch {}
    }

    function syncCustomPortionsArray() {
      while (customPortions.length < portionCount) {
        customPortions.push({ variant: expressVariant, addKaiDao: expressKaiDao });
      }
      if (customPortions.length > portionCount) {
        customPortions = customPortions.slice(0, portionCount);
      }
    }

    function computeTotal() {
      let sum = 0;
      if (builderMode === "express") {
        sum += portionCount * (PRICES[expressVariant] + (expressKaiDao ? PRICES.kaiDao : 0));
      } else {
        customPortions.forEach((p) => {
          sum += PRICES[p.variant] + (p.addKaiDao ? PRICES.kaiDao : 0);
        });
      }
      sum += drinks.thai_iced_tea * PRICES.thai_iced_tea;
      sum += drinks.coconut_water * PRICES.coconut_water;
      return sum;
    }

    function renderCustomBuilder() {
      const container = document.getElementById("customBuilder");
      if (builderMode !== "custom") {
        container.style.display = "none";
        document.getElementById("expressBuilder").style.display = "block";
        return;
      }
      document.getElementById("expressBuilder").style.display = "none";
      container.style.display = "block";
      container.innerHTML = customPortions.map((p, idx) => \`
        <div class="portion-box-card">
          <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--gold); margin-bottom: 0.45rem;">
            BOX #\${idx + 1} VON \${portionCount}
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem;">
            \${["vegan", "chicken", "pork_mix"].map((v) => \`
              <button type="button" class="mode-btn \${p.variant === v ? 'active' : ''}" data-cidx="\${idx}" data-cvar="\${v}">
                \${NAMES[v]} (CHF \${PRICES[v]})
              </button>
            \`).join("")}
          </div>
          <label style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.55rem; font-size: 0.84rem; cursor: pointer;">
            <input type="checkbox" \${p.addKaiDao ? "checked" : ""} data-cidx="\${idx}" class="custom-kaidao-cb">
            <span>🍳 + Kai Dao Spiegelei (+ CHF 2.50)</span>
          </label>
        </div>
      \`).join("");

      container.querySelectorAll("[data-cvar]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = Number(btn.getAttribute("data-cidx"));
          customPortions[i].variant = btn.getAttribute("data-cvar");
          renderUI();
        });
      });
      container.querySelectorAll(".custom-kaidao-cb").forEach((cb) => {
        cb.addEventListener("change", () => {
          const i = Number(cb.getAttribute("data-cidx"));
          customPortions[i].addKaiDao = cb.checked;
          renderUI();
        });
      });
    }

    function renderUI() {
      syncCustomPortionsArray();
      document.getElementById("portionCountDisplay").textContent = String(portionCount);
      document.getElementById("portionBadge").textContent = portionCount + (portionCount === 1 ? " Portion" : " Portionen");
      document.getElementById("btnDecPortion").disabled = portionCount <= 1;
      document.getElementById("btnIncPortion").disabled = portionCount >= 10;

      document.getElementById("groupModeSwitch").style.display = portionCount > 1 ? "flex" : "none";
      if (portionCount === 1) builderMode = "express";

      document.getElementById("modeExpressBtn").classList.toggle("active", builderMode === "express");
      document.getElementById("modeCustomBtn").classList.toggle("active", builderMode === "custom");

      document.querySelectorAll("#expressVariantGrid .variant-btn").forEach((b) => {
        b.classList.toggle("selected", b.getAttribute("data-variant") === expressVariant);
      });
      document.getElementById("expressKaiDaoBtn").classList.toggle("checked", expressKaiDao);

      renderCustomBuilder();

      document.getElementById("drink_thai_iced_tea").textContent = String(drinks.thai_iced_tea);
      document.getElementById("drink_coconut_water").textContent = String(drinks.coconut_water);

      document.querySelectorAll("#paymentGrid .pay-btn").forEach((b) => {
        b.classList.toggle("selected", b.getAttribute("data-pay") === paymentMethod);
      });
      document.getElementById("cashInfoNote").style.display = paymentMethod === "cash" ? "block" : "none";

      const total = computeTotal();
      document.getElementById("totalPriceDisplay").textContent = "CHF " + total.toFixed(2);
    }

    document.getElementById("btnDecPortion").addEventListener("click", () => {
      if (portionCount > 1) { portionCount--; renderUI(); }
    });
    document.getElementById("btnIncPortion").addEventListener("click", () => {
      if (portionCount < 10) { portionCount++; renderUI(); }
    });
    document.getElementById("modeExpressBtn").addEventListener("click", () => { builderMode = "express"; renderUI(); });
    document.getElementById("modeCustomBtn").addEventListener("click", () => { builderMode = "custom"; renderUI(); });

    document.querySelectorAll("#expressVariantGrid .variant-btn").forEach((b) => {
      b.addEventListener("click", () => {
        expressVariant = b.getAttribute("data-variant");
        renderUI();
      });
    });

    document.getElementById("expressKaiDaoBtn").addEventListener("click", () => {
      expressKaiDao = !expressKaiDao;
      renderUI();
    });

    document.querySelectorAll(".drink-inc").forEach((b) => {
      b.addEventListener("click", () => {
        const d = b.getAttribute("data-drink");
        drinks[d] = Math.min(10, (drinks[d] || 0) + 1);
        renderUI();
      });
    });
    document.querySelectorAll(".drink-dec").forEach((b) => {
      b.addEventListener("click", () => {
        const d = b.getAttribute("data-drink");
        drinks[d] = Math.max(0, (drinks[d] || 0) - 1);
        renderUI();
      });
    });

    document.querySelectorAll("#paymentGrid .pay-btn").forEach((b) => {
      b.addEventListener("click", () => {
        paymentMethod = b.getAttribute("data-pay");
        renderUI();
      });
    });

    document.getElementById("submitOrderBtn").addEventListener("click", async () => {
      const errEl = document.getElementById("orderErrorMsg");
      errEl.textContent = "";
      const selectedSpice = customSpiceEnabled
        ? document.getElementById("customSpiceSelect").value
        : "leicht_scharf";

      const portionsPayload = builderMode === "express"
        ? Array.from({ length: portionCount }, () => ({
            variant: expressVariant,
            spiceLevel: selectedSpice,
            addKaiDao: expressKaiDao
          }))
        : customPortions.map((p) => ({
            variant: p.variant,
            spiceLevel: selectedSpice,
            addKaiDao: p.addKaiDao
          }));

      const drinksPayload = Object.entries(drinks)
        .filter(([, q]) => q > 0)
        .map(([drinkId, quantity]) => ({ drinkId, quantity }));

      const preferredPlz = document.getElementById("prefPlzSelect").value || undefined;

      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2)
          },
          body: JSON.stringify({
            portions: portionsPayload,
            drinks: drinksPayload,
            paymentMethod,
            preferredPlz
          })
        });
        const json = await res.json();
        if (!json.success) {
          errEl.textContent = json.error?.message || "Bestellung konnte nicht gesendet werden.";
          return;
        }
        showLiveTicket(json.data.order);
      } catch (e) {
        errEl.textContent = "Netzwerkfehler – bitte kurz an der Foodtruck-Kasse melden.";
      }
    });

    function showLiveTicket(order) {
      activeOrderId = order.id;
      document.getElementById("orderBuilderView").style.display = "none";
      document.getElementById("liveTicketView").style.display = "block";
      renderTicketState(order);

      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(async () => {
        if (!activeOrderId) return;
        try {
          const r = await fetch("/api/orders/" + activeOrderId);
          const j = await r.json();
          if (j.success && j.data.order) {
            renderTicketState(j.data.order);
          }
        } catch {}
      }, 1500);
    }

    function renderTicketState(order) {
      document.getElementById("ticketPlz").textContent = order.zueriCode.plz;
      document.getElementById("ticketQuarter").textContent = order.zueriCode.quarter;
      document.getElementById("ticketMeta").textContent =
        order.totalPortions + " Portion(en) · Total CHF " + order.totalChf.toFixed(2) + " · " + order.paymentMethod.toUpperCase();

      const alertBanner = document.getElementById("ticketAlertBanner");
      const cardBox = document.getElementById("ticketCardBox");
      cardBox.classList.toggle("is-ready", order.status === "ready");

      if (order.status === "pending_cash") {
        alertBanner.style.display = "block";
        alertBanner.style.background = "rgba(255, 213, 79, 0.16)";
        alertBanner.style.border = "1.5px solid var(--gold)";
        alertBanner.style.color = "var(--gold)";
        alertBanner.innerHTML = "💵 <strong>Wartet auf Barzahlung (Pending):</strong> Bitte nenne an der Foodtruck-Kasse deinen Code <strong>" + order.zueriCode.formatted + "</strong> und bezahle <strong>CHF " + order.totalChf.toFixed(2) + "</strong>.";
      } else if (order.status === "payment_error_fallback") {
        alertBanner.style.display = "block";
        alertBanner.style.background = "rgba(229, 57, 53, 0.2)";
        alertBanner.style.border = "1.5px solid var(--chili)";
        alertBanner.style.color = "#FFCDD2";
        alertBanner.innerHTML = "⚠️ <strong>Manuelle Kassen-Freigabe:</strong> Dein Code <strong>" + order.zueriCode.formatted + "</strong> ist reserviert! Bitte kurz an der Kasse bestätigen.";
      } else if (order.status === "ready") {
        alertBanner.style.display = "block";
        alertBanner.style.background = "rgba(82, 196, 90, 0.25)";
        alertBanner.style.border = "2px solid var(--green-neon)";
        alertBanner.style.color = "#F5F7F5";
        alertBanner.innerHTML = "🔔 <strong>DEIN PAD KRAPAO IST ABHOLBEREIT!</strong> Komm jetzt mit deinem Code <strong>" + order.zueriCode.formatted + "</strong> zur Ausgabe!";
      } else {
        alertBanner.style.display = "none";
      }

      const stepCash = document.getElementById("stepCash");
      const stepWok = document.getElementById("stepWok");
      const stepPlating = document.getElementById("stepPlating");
      const stepReady = document.getElementById("stepReady");

      [stepCash, stepWok, stepPlating, stepReady].forEach((el) => {
        el.className = "status-step";
      });

      if (order.status === "pending_cash") {
        stepCash.classList.add("cash-wait");
      } else if (order.status === "payment_error_fallback") {
        stepCash.classList.add("error-wait");
      } else if (order.status === "received" || order.status === "in_wok") {
        stepWok.classList.add("active");
      } else if (order.status === "plating") {
        stepPlating.classList.add("active");
      } else if (order.status === "ready" || order.status === "completed") {
        stepReady.classList.add("active");
      }

      const itemsHtml = order.portions.map((p) =>
        \`<div>• Box #\${p.portionIndex}: <strong>\${NAMES[p.variant]}</strong> \${p.addKaiDao ? "(+ Kai Dao Spiegelei 🍳)" : ""} · <em>\${p.spiceLevel.replace(/_/g, " ")}</em></div>\`
      ).join("") + (order.drinks.length ? "<div style='margin-top:0.4rem;color:var(--gold);'>Drinks: " + order.drinks.map((d) => d.quantity + "x " + d.drinkId.replace(/_/g, " ")).join(", ") + "</div>" : "");

      document.getElementById("ticketItemsList").innerHTML = itemsHtml;
    }

    document.getElementById("newOrderBtn").addEventListener("click", () => {
      activeOrderId = null;
      if (pollTimer) clearInterval(pollTimer);
      document.getElementById("liveTicketView").style.display = "none";
      document.getElementById("orderBuilderView").style.display = "block";
    });

    loadFeatureFlags();
    renderUI();
  </script>
</body>
</html>`;
}
