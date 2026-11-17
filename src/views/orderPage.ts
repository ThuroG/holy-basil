import {
  MENU_DISHES,
  MENU_DRINKS,
  KAI_DAO_PRICE_CHF,
  HOLY_GAINS_PRICE_CHF,
  NUTRITION_ESTIMATES,
  getFeatureFlags,
} from '../config/features.js';
import {
  ALLERGEN_IDS,
  buildCheckoutDeclaration,
  buildMenuDeclaration,
  complianceConfig,
  ComplianceItemId,
  MenuDeclaration,
} from '../config/compliance.js';
import { ZUERI_CODE_POOL } from '../lib/zueriCodes.js';
import { DishVariantId, DrinkId } from '../lib/types.js';
import {
  DESIGN_TOKENS_CSS,
  FONT_LINK,
  LEGAL_LINKS_HTML,
  LOGO_STICKER_TRANSPARENT,
  escHtml,
  scriptJson,
} from './shared.js';

function chf(value: number): string {
  return value.toFixed(2);
}

const VARIANT_ORDER: readonly DishVariantId[] = ['vegan', 'chicken', 'pork_mix'];
const DRINK_ORDER: readonly DrinkId[] = ['thai_iced_tea', 'coconut_water', 'zueri_mate'];
const VARIANT_ICON: Record<DishVariantId, string> = { vegan: '🌱', chicken: '🍗', pork_mix: '🥩' };

function subsets<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let mask = 0; mask < 1 << items.length; mask++) {
    out.push(items.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

/**
 * Every cart the page can build, rendered by buildCheckoutDeclaration() on the server.
 * The browser only looks the lines up; it never composes a declaration text itself.
 *
 * Key: "<variants>|<egg>|<drinks>" with egg = n (none), e (Kai Dao, not on Holy Vegan),
 * v (Kai Dao on Holy Vegan).
 */
function buildDeclarationTable(stopId: string | null) {
  const lines: Array<{ t: string; k: 'fact' | 'note' }> = [];
  const carts: Record<string, { l: number[]; b: boolean }> = {};
  const notes = new Set([
    complianceConfig.texts.crossContact,
    complianceConfig.texts.veganNote,
    complianceConfig.texts.vegetarianNote,
  ]);
  const indexOf = (text: string): number => {
    let idx = lines.findIndex((l) => l.t === text);
    if (idx < 0) {
      idx = lines.length;
      lines.push({ t: text, k: notes.has(text) ? 'note' : 'fact' });
    }
    return idx;
  };

  for (const variants of subsets(VARIANT_ORDER)) {
    if (variants.length === 0) continue;
    const eggStates = variants.includes('vegan') ? (['n', 'e', 'v'] as const) : (['n', 'e'] as const);
    for (const egg of eggStates) {
      // "e" with only Holy Vegan in the cart cannot exist: an egg there is always "v".
      if (egg === 'e' && variants.length === 1 && variants[0] === 'vegan') continue;
      for (const drinks of subsets(DRINK_ORDER)) {
        const portions = variants.map((variant) => ({
          variant,
          addKaiDao: egg === 'v' ? variant === 'vegan' : egg === 'e' ? variant !== 'vegan' : false,
        }));
        const decl = buildCheckoutDeclaration(
          { portions, drinks: drinks.map((drinkId) => ({ drinkId, quantity: 1 })) },
          stopId
        );
        carts[`${variants.join('+')}|${egg}|${drinks.join('+')}`] = {
          l: decl.lines.map(indexOf),
          b: decl.blocked,
        };
      }
    }
  }
  return { lines, carts };
}

/** Static allergen and ingredient block that opens inline in the checkout. */
function renderAllergenDetails(menu: MenuDeclaration): string {
  const columns: Array<{ id: ComplianceItemId; short: string }> = [
    { id: 'vegan', short: 'Vegan' },
    { id: 'chicken', short: 'Chicken' },
    { id: 'pork_mix', short: 'Pork/Mix' },
    { id: 'kai_dao', short: 'Kai Dao' },
    { id: 'thai_iced_tea', short: 'Iced Tea' },
    { id: 'coconut_water', short: 'Kokos' },
  ];
  const head = columns.map((c) => `<th>${escHtml(c.short)}</th>`).join('');
  const rows = ALLERGEN_IDS.map((a) => {
    const cells = columns
      .map((c) => {
        const item = menu.items[c.id];
        const mark = item.contains.includes(a) ? '●' : item.mayContain.includes(a) ? '◐' : '–';
        return `<td>${mark}</td>`;
      })
      .join('');
    return `<tr><th scope="row">${escHtml(menu.allergenLabels[a])}</th>${cells}</tr>`;
  }).join('');
  const ingredients = columns
    .map((c) => {
      const item = menu.items[c.id];
      return `<div class="ing"><strong>${escHtml(item.label)}:</strong> ${escHtml(item.ingredients)}</div>`;
    })
    .join('');

  return `
        <div class="alg-legend">● ${escHtml(menu.texts.containsPrefix)} · ◐ ${escHtml(menu.texts.mayContainPrefix)} · – nicht enthalten</div>
        <div class="alg-scroll">
          <table class="alg-table">
            <thead><tr><th></th>${head}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${ingredients}
        <div class="ing">${escHtml(menu.texts.allergenShort)}</div>
        <div class="ing">${escHtml(menu.texts.recipeBinder)}</div>
        <div class="ing" style="color: var(--muted);">Stand: ${escHtml(menu.reviewedAt)} · Version ${escHtml(menu.version)}</div>`;
}

export function renderOrderPageHtml(stopId: string | null = null): string {
  const flags = getFeatureFlags();
  const menu = buildMenuDeclaration(stopId);
  const table = buildDeclarationTable(stopId);

  // Everything the client script needs, taken from the server-side config: one source of truth.
  const pageData = scriptJson({
    dishes: Object.fromEntries(VARIANT_ORDER.map((v) => [v, MENU_DISHES[v].priceChf])),
    drinks: Object.fromEntries(Object.values(MENU_DRINKS).map((d) => [d.id, d.priceChf])),
    kaiDao: KAI_DAO_PRICE_CHF,
    holyGains: HOLY_GAINS_PRICE_CHF,
    nutrition: NUTRITION_ESTIMATES,
    enableHolyGains: flags.enableHolyGains,
    enableCustomSpiceLevels: flags.enableCustomSpiceLevels,
    maxPortions: flags.maxPortionsPerOrder,
    variantOrder: VARIANT_ORDER,
    drinkOrder: DRINK_ORDER,
    blocked: Object.fromEntries(VARIANT_ORDER.map((v) => [v, menu.items[v].blocked])),
    decl: table,
    texts: {
      allergenShort: menu.texts.allergenShort,
      originMissing: menu.texts.originMissing,
    },
  });

  const cards = VARIANT_ORDER.map((v) => {
    const dish = MENU_DISHES[v];
    const item = menu.items[v];
    const nut = NUTRITION_ESTIMATES[v];
    const origin = item.blocked
      ? `<div class="variant-origin variant-origin--missing">${escHtml(menu.texts.originMissing)}</div>`
      : item.originLines.map((l) => `<div class="variant-origin">${escHtml(l)}</div>`).join('');
    return `
          <button type="button" class="variant-btn" data-variant="${v}" aria-pressed="false"${item.blocked ? ' disabled' : ''}>
            <div>
              <div class="variant-name">${VARIANT_ICON[v]} ${escHtml(dish.name)}</div>
              <div class="variant-sub">${escHtml(dish.tagline)}</div>
              <div class="variant-nut">🔥 ca. ${nut.caloriesKcal} kcal · ${nut.proteinGrams}g Protein · ${nut.carbsGrams}g KH · ${nut.fatGrams}g Fett</div>
              ${origin}
            </div>
            <div class="variant-price">CHF ${chf(dish.priceChf)}</div>
          </button>`;
  }).join('');

  const plzOptions = ZUERI_CODE_POOL.map(
    (c) => `<option value="${escHtml(c.plz)}">${escHtml(c.plz)} · ${escHtml(c.quarter)}</option>`
  ).join('');

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>HOLY BASIL · Bestellen & Züri-Code Ticket</title>
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
      --footer-h: 7.5rem;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--font-body);
      -webkit-font-smoothing: antialiased;
    }
    a { color: var(--muted); }
    .topbar {
      background: var(--bg-primary);
      border-bottom: 1.5px solid rgba(82, 196, 90, 0.38);
      padding: 0.5rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .topbar__brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      color: var(--ink);
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1rem;
    }
    .topbar__brand img { width: 32px; height: 32px; display: block; }
    .topbar__actions { display: flex; align-items: center; gap: 0.4rem; }
    .sunlight-btn {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--ink);
      background: var(--surface-2);
      border: 1.5px solid rgba(255, 213, 79, 0.45);
      padding: 0.28rem 0.55rem;
      border-radius: 8px;
      cursor: pointer;
    }
    .sunlight-btn[aria-pressed="true"] {
      background: var(--gold);
      color: #0A0A0A;
      border-color: var(--gold);
    }
    .pill-link {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--ink);
      background: var(--surface-2);
      border: 1.5px solid rgba(82, 196, 90, 0.48);
      padding: 0.3rem 0.6rem;
      border-radius: 8px;
      text-decoration: none;
    }
    .container { max-width: 600px; margin: 0 auto; padding: 0.75rem 0.85rem; }
    #orderBuilderView { padding-bottom: var(--footer-h); }
    .badge {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.22rem 0.5rem;
      border-radius: 6px;
      background: var(--green-deep);
      color: var(--ink);
      border: 1px solid var(--green-neon);
    }
    .badge--gold { background: rgba(255, 213, 79, 0.15); color: var(--gold); border-color: var(--gold); }
    .status-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.4rem;
      margin-bottom: 0.6rem;
    }
    .notice {
      padding: 0.65rem 0.8rem;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 700;
      margin-bottom: 0.6rem;
      background: rgba(229, 57, 53, 0.2);
      border: 1.5px solid var(--chili);
      color: #FFCDD2;
    }
    h1.page-title,
    h2.page-title {
      font-family: var(--font-display);
      font-size: 1.15rem;
      margin: 0 0 0.55rem 0;
    }
    .page-title--section { margin-top: 1rem; }
    .variant-grid { display: grid; gap: 0.5rem; }
    .variant-btn {
      width: 100%;
      min-height: 64px;
      text-align: left;
      background: #0E1410;
      border: 2px solid rgba(82, 196, 90, 0.28);
      border-radius: 14px;
      padding: 0.6rem 0.85rem;
      color: var(--ink);
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: border-color 0.12s ease, background 0.12s ease;
    }
    .variant-btn.selected {
      background: #17281B;
      border-color: var(--green-neon);
      box-shadow: 0 0 0 1px var(--green-neon);
    }
    .variant-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .variant-name { font-family: var(--font-display); font-size: 1.02rem; font-weight: 800; }
    .variant-sub { font-size: 0.76rem; color: var(--muted); margin-top: 0.1rem; }
    .variant-nut { font-family: var(--font-mono); font-size: 0.7rem; color: var(--green-neon); margin-top: 0.16rem; }
    .variant-origin { font-size: 0.74rem; color: var(--ink); margin-top: 0.1rem; }
    .variant-origin--missing { color: #FFCDD2; }
    .variant-price {
      font-family: var(--font-mono);
      font-weight: 800;
      font-size: 1rem;
      color: var(--gold);
      flex-shrink: 0;
      margin-left: 0.6rem;
    }
    .kaidao-toggle {
      margin-top: 0.5rem;
      width: 100%;
      min-height: 52px;
      padding: 0.55rem 0.85rem;
      border-radius: 12px;
      border: 2px dashed var(--gold);
      background: rgba(255, 213, 79, 0.08);
      color: var(--ink);
      font-family: inherit;
      text-align: left;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      cursor: pointer;
      font-weight: 700;
      font-size: 0.92rem;
    }
    .kaidao-toggle.checked { border-style: solid; background: rgba(255, 213, 79, 0.22); }
    .kaidao-sub { font-size: 0.72rem; font-weight: 500; color: var(--muted); margin-top: 0.1rem; }
    .gains-toggle {
      margin-top: 0.5rem;
      width: 100%;
      min-height: 52px;
      padding: 0.55rem 0.85rem;
      border-radius: 12px;
      border: 2px dashed var(--green-neon);
      background: rgba(82, 196, 90, 0.08);
      color: var(--ink);
      font-family: inherit;
      text-align: left;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      cursor: pointer;
      font-weight: 700;
      font-size: 0.92rem;
    }
    .gains-toggle.checked { border-style: solid; background: rgba(82, 196, 90, 0.22); }
    .nutrition-summary {
      margin-top: 0.55rem;
      background: var(--surface);
      border: 1px solid rgba(82, 196, 90, 0.3);
      border-radius: 12px;
      padding: 0.65rem 0.85rem;
      font-size: 0.84rem;
    }
    .nutrition-vals { font-family: var(--font-mono); font-weight: 700; color: var(--green-neon); margin-top: 0.2rem; }
    .nutrition-note { font-size: 0.7rem; color: var(--muted); margin-top: 0.2rem; }
    .row {
      margin-top: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--surface);
      padding: 0.5rem 0.85rem;
      border-radius: 12px;
      border: 1px solid rgba(82, 196, 90, 0.3);
      font-weight: 700;
      font-size: 0.92rem;
    }
    .stepper-controls { display: flex; align-items: center; gap: 0.7rem; }
    .step-btn {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      border: 2px solid var(--green-neon);
      background: #0F1711;
      color: var(--ink);
      font-family: var(--font-mono);
      font-size: 1.2rem;
      font-weight: 800;
      cursor: pointer;
    }
    .step-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .step-count {
      font-family: var(--font-mono);
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--gold);
      min-width: 1.8rem;
      text-align: center;
    }
    .mode-switch { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
    .mode-btn {
      flex: 1;
      padding: 0.55rem;
      border-radius: 10px;
      border: 1.5px solid rgba(82, 196, 90, 0.3);
      background: #0D120E;
      color: var(--muted);
      font-family: inherit;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
    }
    .mode-btn.active { background: var(--green-deep); color: var(--ink); border-color: var(--green-neon); }
    .portion-box-card {
      background: #0D130F;
      border: 1px solid rgba(82, 196, 90, 0.3);
      border-radius: 14px;
      padding: 0.7rem;
      margin-top: 0.5rem;
    }
    .spice-select {
      width: 100%;
      padding: 0.6rem;
      border-radius: 10px;
      background: #0B100C;
      color: var(--ink);
      border: 1.5px solid var(--green-neon);
      font-family: var(--font-body);
      font-size: 0.95rem;
      font-weight: 600;
      margin-top: 0.35rem;
    }
    details.more {
      margin-top: 0.5rem;
      background: var(--surface);
      border: 1px solid rgba(82, 196, 90, 0.3);
      border-radius: 12px;
      padding: 0 0.85rem;
    }
    details.more > summary {
      cursor: pointer;
      padding: 0.7rem 0;
      font-weight: 700;
      font-size: 0.92rem;
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
    }
    details.more[open] { padding-bottom: 0.7rem; }
    .drink-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.45rem 0;
      border-top: 1px solid rgba(255,255,255,0.08);
      font-size: 0.9rem;
    }
    .page-foot { margin-top: 1rem; font-size: 0.74rem; color: var(--muted); text-align: center; }

    /* Checkout bar: declaration and pay button always together, always on screen. */
    .checkout-bar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 50;
      background: #0A0D0B;
      border-top: 2px solid var(--green-neon);
      padding: 0.55rem 0.85rem calc(0.6rem + env(safe-area-inset-bottom)) 0.85rem;
    }
    .checkout-inner { max-width: 600px; margin: 0 auto; }
    .decl { font-size: 0.74rem; line-height: 1.32; }
    .decl-line--fact { color: var(--ink); font-weight: 600; }
    .decl-line--note { color: var(--muted); }
    .decl-line--blocked { color: #FFCDD2; font-weight: 700; }
    details.alg { margin-top: 0.25rem; font-size: 0.76rem; }
    details.alg > summary { cursor: pointer; color: var(--green-neon); font-weight: 700; padding: 0.2rem 0; }
    .alg-body { max-height: 42vh; overflow-y: auto; padding: 0.3rem 0 0.4rem 0; }
    .alg-legend { color: var(--muted); margin-bottom: 0.3rem; }
    .alg-scroll { overflow-x: auto; }
    .alg-table { border-collapse: collapse; width: 100%; font-size: 0.72rem; }
    .alg-table th, .alg-table td { border-bottom: 1px solid rgba(255,255,255,0.1); padding: 0.18rem 0.3rem; text-align: center; }
    .alg-table th[scope="row"] { text-align: left; font-weight: 600; white-space: nowrap; }
    .ing { margin-top: 0.35rem; }
    .decl-pill {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      background: #131914;
      border: 1px solid rgba(82, 196, 90, 0.35);
      border-radius: 10px;
      padding: 0.42rem 0.7rem;
      color: var(--muted);
      font-family: inherit;
      font-size: 0.76rem;
      cursor: pointer;
      text-align: left;
    }
    .decl-pill.blocked { border-color: var(--chili); color: #FFCDD2; background: rgba(229, 57, 53, 0.14); }
    .decl-pill-action { color: var(--green-neon); font-weight: 700; flex-shrink: 0; }
    .hb-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 120;
      background: rgba(0, 0, 0, 0.78);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 0.75rem;
    }
    .hb-modal-backdrop[hidden] { display: none; }
    @media (min-width: 600px) { .hb-modal-backdrop { align-items: center; } }
    .hb-modal {
      width: 100%;
      max-width: 560px;
      max-height: 85vh;
      background: #101712;
      border: 2px solid var(--green-neon);
      border-radius: 18px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9);
    }
    .hb-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.65rem; }
    .hb-modal-head h2 { margin: 0; font-family: var(--font-display); font-size: 1.05rem; }
    .hb-modal-close {
      background: #1A231C;
      border: 1px solid rgba(82, 196, 90, 0.4);
      color: var(--ink);
      border-radius: 8px;
      width: 34px;
      height: 34px;
      font-size: 1rem;
      cursor: pointer;
    }
    .hb-modal-body { overflow-y: auto; flex: 1; padding-right: 0.2rem; font-size: 0.8rem; }
    .pay-grid { display: flex; gap: 0.4rem; margin-top: 0.4rem; }
    .pay-btn {
      flex: 1;
      padding: 0.5rem 0.3rem;
      border-radius: 10px;
      border: 2px solid rgba(82, 196, 90, 0.3);
      background: #0E1410;
      color: var(--ink);
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .pay-btn.selected { background: var(--green-deep); border-color: var(--green-neon); }
    .submit-btn {
      width: 100%;
      min-height: 54px;
      margin-top: 0.45rem;
      border-radius: 14px;
      border: 0;
      background: var(--green-neon);
      color: #061108;
      font-family: var(--font-display);
      font-size: 1.05rem;
      font-weight: 800;
      cursor: pointer;
    }
    .submit-btn:disabled { background: #2A352C; color: var(--muted); cursor: not-allowed; }
    .order-error { color: #FF8A80; font-size: 0.82rem; text-align: center; min-height: 0; }

    /* LIVE ZÜRI-CODE BOARDING PASS TICKET & MICRO-INTERACTIONS (IN_WOK -> READY_FOR_PICKUP) */
    .ticket-card {
      position: relative;
      overflow: hidden;
      background: var(--surface);
      border: 3px solid var(--green-neon);
      border-radius: 24px;
      padding: 1.35rem 1.25rem;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85);
      transition: background-color 420ms cubic-bezier(0.22, 1, 0.36, 1),
                  border-color 420ms cubic-bezier(0.22, 1, 0.36, 1),
                  transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
      contain: layout paint;
    }
    /* Die-cut Boarding Pass Notches */
    .ticket-card::before,
    .ticket-card::after {
      content: "";
      position: absolute;
      top: 178px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--bg);
      border: 3px solid var(--green-neon);
      z-index: 3;
      pointer-events: none;
      transition: border-color 420ms ease;
    }
    .ticket-card::before { left: -15px; }
    .ticket-card::after { right: -15px; }
    .ticket-card.is-ready::before,
    .ticket-card.is-ready::after {
      border-color: var(--gold);
    }

    /* Perforated Tear Line */
    .ticket-perf {
      position: relative;
      margin: 0.95rem -0.4rem 0.85rem -0.4rem;
      border-top: 2px dashed rgba(82, 196, 90, 0.38);
      transition: border-color 420ms ease;
    }
    .ticket-card.is-ready .ticket-perf {
      border-top-color: rgba(255, 213, 79, 0.65);
    }

    /* Wok Heat Progress Shimmer (active during IN_WOK / PLATING) */
    .ticket-heat-bar {
      height: 4px;
      width: 100%;
      border-radius: 999px;
      margin-top: 0.65rem;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
      opacity: 0;
      transition: opacity 260ms ease;
    }
    .ticket-card.is-cooking .ticket-heat-bar {
      opacity: 1;
    }
    .ticket-heat-bar__fill {
      height: 100%;
      width: 45%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--green-neon), var(--gold), #FF7043);
      animation: wokHeatSweep 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      will-change: transform;
    }
    @keyframes wokHeatSweep {
      0% { transform: translateX(-110%); }
      100% { transform: translateX(240%); }
    }

    /* READY_FOR_PICKUP State & Transition Choreography */
    .ticket-card.is-ready {
      background: #132A18;
      border-color: var(--gold);
      animation: pulseGlow 1.6s infinite alternate;
    }
    .ticket-card.is-transitioning-ready {
      animation: ticketReadyPop 620ms cubic-bezier(0.18, 1.25, 0.32, 1);
    }
    @keyframes ticketReadyPop {
      0% { transform: scale(0.96); }
      45% { transform: scale(1.025); }
      100% { transform: scale(1); }
    }
    @keyframes pulseGlow {
      from { box-shadow: 0 0 16px rgba(82, 196, 90, 0.45); }
      to { box-shadow: 0 0 42px rgba(255, 213, 79, 0.9); }
    }

    /* Shockwave Ripple Rings on IN_WOK -> READY transition */
    .ticket-shockwave {
      position: absolute;
      top: 96px;
      left: 50%;
      width: 140px;
      height: 140px;
      margin-left: -70px;
      margin-top: -70px;
      border-radius: 50%;
      border: 3px solid var(--gold);
      opacity: 0;
      pointer-events: none;
      z-index: 1;
    }
    .ticket-card.is-transitioning-ready .ticket-shockwave--1 {
      animation: shockwaveExpand 820ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .ticket-card.is-transitioning-ready .ticket-shockwave--2 {
      border-color: var(--green-neon);
      animation: shockwaveExpand 980ms 110ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes shockwaveExpand {
      0% { transform: scale(0.35); opacity: 0.95; }
      100% { transform: scale(3.6); opacity: 0; }
    }

    /* 3D Split-Flap Code Display on Ticket */
    .ticket-flap-stage {
      perspective: 700px;
      position: relative;
      z-index: 2;
    }
    .ticket-plz {
      font-family: var(--font-mono);
      font-size: 4rem;
      font-weight: 800;
      color: var(--gold);
      line-height: 1;
      margin: 0.4rem 0 0.15rem 0;
      backface-visibility: hidden;
      will-change: transform;
    }
    .ticket-quarter {
      font-family: var(--font-display);
      font-size: 1.65rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      backface-visibility: hidden;
      will-change: transform;
    }
    .ticket-card.is-transitioning-ready .ticket-plz {
      animation: ticketFlapIn 420ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .ticket-card.is-transitioning-ready .ticket-quarter {
      animation: ticketFlapIn 480ms 60ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
    }
    @keyframes ticketFlapIn {
      0% { transform: rotateX(-85deg) scale(0.92); opacity: 0.25; }
      65% { transform: rotateX(12deg) scale(1.03); opacity: 1; }
      100% { transform: rotateX(0deg) scale(1); opacity: 1; }
    }

    /* Street-Art Stamp Badge ("ABHOLBEREIT AM FENSTER") */
    .ticket-stamp {
      display: none;
      margin: 0.55rem auto 0.2rem auto;
      padding: 0.28rem 0.85rem;
      border: 2.5px solid var(--gold);
      border-radius: 8px;
      background: rgba(255, 213, 79, 0.16);
      color: var(--gold);
      font-family: var(--font-mono);
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      transform: rotate(-2deg);
    }
    .ticket-card.is-ready .ticket-stamp {
      display: inline-block;
      animation: stampSlam 440ms cubic-bezier(0.18, 1.3, 0.32, 1) forwards;
    }
    @keyframes stampSlam {
      0% { transform: scale(2.1) rotate(-8deg); opacity: 0; }
      70% { transform: scale(0.94) rotate(-1.5deg); opacity: 1; }
      100% { transform: scale(1) rotate(-2deg); opacity: 1; }
    }

    .status-steps { margin: 1.1rem 0; text-align: left; display: grid; gap: 0.5rem; position: relative; z-index: 2; }
    .status-step {
      padding: 0.65rem 0.9rem;
      border-radius: 12px;
      background: #0B100C;
      border: 1.5px solid rgba(255,255,255,0.14);
      font-size: 0.88rem;
      color: var(--muted);
      transition: transform 240ms ease, background-color 240ms ease, border-color 240ms ease, color 240ms ease;
    }
    .status-step.is-done {
      background: rgba(27, 77, 46, 0.38);
      border-color: rgba(82, 196, 90, 0.55);
      color: var(--ink);
    }
    .status-step.active {
      background: var(--green-deep);
      border-color: var(--green-neon);
      color: var(--ink);
      font-weight: 700;
      transform: translateX(3px);
    }
    .ticket-card.is-ready #stepReady.active {
      background: var(--gold);
      border-color: var(--gold);
      color: #0A0A0A;
      font-weight: 800;
      box-shadow: 0 6px 20px rgba(255, 213, 79, 0.38);
    }
    .ticket-bell {
      display: inline-block;
      transform-origin: top center;
    }
    .ticket-card.is-ready .ticket-bell {
      animation: bellSwing 0.9s ease-in-out infinite alternate;
    }
    @keyframes bellSwing {
      0% { transform: rotate(-16deg) scale(1.08); }
      100% { transform: rotate(16deg) scale(1.08); }
    }
    .status-step.cash-wait { background: rgba(255, 213, 79, 0.16); border-color: var(--gold); color: var(--gold); font-weight: 700; }
    .status-step.error-wait { background: rgba(229, 57, 53, 0.2); border-color: var(--chili); color: #FFCDD2; font-weight: 700; }
    @media (prefers-reduced-motion: reduce) {
      .ticket-card.is-ready,
      .ticket-card.is-transitioning-ready,
      .ticket-heat-bar__fill,
      .ticket-card.is-transitioning-ready .ticket-shockwave--1,
      .ticket-card.is-transitioning-ready .ticket-shockwave--2,
      .ticket-card.is-transitioning-ready .ticket-plz,
      .ticket-card.is-transitioning-ready .ticket-quarter,
      .ticket-card.is-ready .ticket-stamp,
      .ticket-card.is-ready .ticket-bell {
        animation: none !important;
      }
    }
    .ticket-block { background: #0B100C; border-radius: 14px; padding: 0.85rem; text-align: left; font-size: 0.86rem; margin-top: 0.6rem; }
    .ticket-pay-link {
      display: block;
      margin-top: 0.6rem;
      padding: 0.8rem;
      border-radius: 12px;
      background: var(--green-neon);
      color: #061108;
      font-family: var(--font-display);
      font-weight: 800;
      text-decoration: none;
      text-align: center;
    }
  </style>
</head>
<body>

  <header class="topbar">
    <a class="topbar__brand" href="/">
      <img src="${LOGO_STICKER_TRANSPARENT}" alt="Holy Basil Logo">
      <span>HOLY BASIL</span>
    </a>
    <div class="topbar__actions">
      <button type="button" class="sunlight-btn" id="sunlightToggleBtn" aria-pressed="false" title="Maximaler Outdoor-Sonnenlicht-Kontrast">☀️ Sonne</button>
      <a class="pill-link" href="/board">Pickup Board</a>
    </div>
  </header>

  <main class="container">
    <!-- ORDER VIEW: one screen, one tap on a card, one tap on the button -->
    <div id="orderBuilderView">
      <div class="status-strip">
        <span class="badge">${escHtml(menu.texts.sauceBadge)}</span>
        <span class="badge badge--gold" id="waitBadge" hidden></span>
      </div>
      <div class="notice" id="pausedNotice" hidden>Wir nehmen gerade keine neuen Bestellungen an. Bitte in ein paar Minuten nochmals versuchen.</div>

      <h1 class="page-title">Wie viele Portionen möchtest du?</h1>

      <div class="row">
        <span>Portionen</span>
        <div class="stepper-controls">
          <button type="button" class="step-btn" id="btnDecPortion" aria-label="Eine Portion weniger">−</button>
          <span class="step-count" id="portionCountDisplay" aria-live="polite">1</span>
          <button type="button" class="step-btn" id="btnIncPortion" aria-label="Eine Portion mehr">+</button>
        </div>
      </div>

      <div class="mode-switch" id="groupModeSwitch" style="display: none;">
        <button type="button" class="mode-btn active" id="modeExpressBtn">Alle gleich</button>
        <button type="button" class="mode-btn" id="modeCustomBtn">Jede Box einzeln</button>
      </div>

      <h2 class="page-title page-title--section">Wähle dein Pad Krapao</h2>

      <!-- Express: one configuration for all portions -->
      <div id="expressBuilder">
        <div class="variant-grid" id="expressVariantGrid">${cards}
        </div>
        <button type="button" class="kaidao-toggle" id="expressKaiDaoBtn" aria-pressed="false">
          <span>
            <span>🍳 + Kai Dao (Thai-Spiegelei)</span>
            <span class="kaidao-sub" id="kaiDaoSub" style="display:block;">${escHtml(menu.eggLine)} · + ca. ${NUTRITION_ESTIMATES.kai_dao.caloriesKcal} kcal · +${NUTRITION_ESTIMATES.kai_dao.proteinGrams}g Protein · +${NUTRITION_ESTIMATES.kai_dao.fatGrams}g Fett</span>
          </span>
          <span style="font-family: var(--font-mono); color: var(--gold); flex-shrink: 0;">+ ${chf(KAI_DAO_PRICE_CHF)}</span>
        </button>
        <button type="button" class="gains-toggle" id="expressHolyGainsBtn" aria-pressed="false" style="display: none;">
          <span>
            <span id="expressHolyGainsLabel">💪 + Holy Gains (Extra Fleisch / Plant-Protein)</span>
            <span class="kaidao-sub" id="expressHolyGainsSub" style="display:block;">+ ca. 200 kcal · +20–28g Protein</span>
          </span>
          <span style="font-family: var(--font-mono); color: var(--green-neon); flex-shrink: 0;">+ ${chf(HOLY_GAINS_PRICE_CHF)}</span>
        </button>
        <div id="expressSpiceContainer" style="display: none; margin-top: 0.5rem;">
          <label for="expressSpiceSelect" style="font-size: 0.82rem; font-weight: 700;">Schärfegrad (für diese Auswahl)</label>
          <select id="expressSpiceSelect" class="spice-select">
            <option value="mild">0 · ไม่เผ็ด (Nicht scharf)</option>
            <option value="leicht_scharf" selected>1 🌶️ · เผ็ดนิดหน่อย (Leicht scharf · Standard)</option>
            <option value="original_thai_spicy">2 🌶️🌶️ · เผ็ดมาก (Scharf)</option>
          </select>
        </div>
      </div>

      <!-- Box-by-box configuration (2..10 portions) -->
      <div id="customBuilder" style="display: none;"></div>

      <details class="more" id="drinksDetails">
        <summary><span>🍹 Drinks dazu</span><span id="drinksSummary" style="color: var(--gold);"></span></summary>
        <div class="drink-row">
          <div>Thai Iced Tea · CHF ${chf(MENU_DRINKS.thai_iced_tea.priceChf)} <span style="font-size: 0.74rem; color: var(--muted);">(ca. ${NUTRITION_ESTIMATES.thai_iced_tea.caloriesKcal} kcal)</span></div>
          <div class="stepper-controls">
            <button type="button" class="step-btn drink-dec" data-drink="thai_iced_tea" aria-label="Ein Thai Iced Tea weniger">−</button>
            <span class="step-count" id="drink_thai_iced_tea">0</span>
            <button type="button" class="step-btn drink-inc" data-drink="thai_iced_tea" aria-label="Ein Thai Iced Tea mehr">+</button>
          </div>
        </div>
        <div class="drink-row">
          <div>Kokoswasser · CHF ${chf(MENU_DRINKS.coconut_water.priceChf)} <span style="font-size: 0.74rem; color: var(--muted);">(ca. ${NUTRITION_ESTIMATES.coconut_water.caloriesKcal} kcal)</span></div>
          <div class="stepper-controls">
            <button type="button" class="step-btn drink-dec" data-drink="coconut_water" aria-label="Ein Kokoswasser weniger">−</button>
            <span class="step-count" id="drink_coconut_water">0</span>
            <button type="button" class="step-btn drink-inc" data-drink="coconut_water" aria-label="Ein Kokoswasser mehr">+</button>
          </div>
        </div>
      </details>

      <details class="more">
        <summary><span>📍 Wunsch-Code (falls frei)</span><span id="plzSummary" style="color: var(--gold);"></span></summary>
        <select id="prefPlzSelect" class="spice-select" style="margin-top: 0;" aria-label="Wunsch-Postleitzahl für den Abholcode">
          <option value="">Automatisch zuweisen</option>
          ${plzOptions}
        </select>
      </details>

      <div class="nutrition-summary" id="nutritionSummaryBox" style="display: none;">
        <div style="font-weight: 700;">Nährwerte (Gesamt-Schätzung)</div>
        <div class="nutrition-vals" id="nutritionValsText"></div>
        <div class="nutrition-note">Hinweis: Alle Angaben sind unverbindliche Schätzwerte (handgemachte Streetfood-Zubereitung im Wok).</div>
      </div>

      <div class="page-foot">${LEGAL_LINKS_HTML}</div>

      <div class="checkout-bar" id="checkoutBar">
        <div class="checkout-inner">
          <button type="button" class="decl-pill" id="openDeclModalBtn" aria-haspopup="dialog">
            <span id="declPillText">ℹ️ Fleischherkunft &amp; Allergene</span>
            <span class="decl-pill-action">Details ↗</span>
          </button>
          <div class="pay-grid" id="paymentGrid" style="display: none;"></div>
          <button type="button" class="submit-btn" id="submitOrderBtn" disabled>Variante wählen</button>
          <div class="order-error" id="orderErrorMsg" role="alert"></div>
        </div>
      </div>

      <!-- Pop-Up Modal for Meat Origin, Allergens & Compliance Notes -->
      <div class="hb-modal-backdrop" id="declarationModal" hidden role="dialog" aria-modal="true" aria-labelledby="declModalTitle">
        <div class="hb-modal">
          <div class="hb-modal-head">
            <h2 id="declModalTitle">Herkunft, Allergene &amp; Hinweise</h2>
            <button type="button" class="hb-modal-close" id="closeDeclModalBtn" aria-label="Schliessen">✕</button>
          </div>
          <div class="hb-modal-body">
            <div class="decl" id="declBlock"></div>
            <div class="alg-body" style="max-height: none; margin-top: 0.75rem;">${renderAllergenDetails(menu)}
            </div>
          </div>
          <button type="button" class="submit-btn" id="closeDeclModalFooterBtn" style="margin-top: 0.75rem; min-height: 44px;">Verstanden</button>
        </div>
      </div>
    </div>

    <!-- LIVE ZÜRI-CODE BOARDING PASS TICKET VIEW -->
    <div id="liveTicketView" style="display: none;">
      <div class="ticket-card" id="ticketCardBox" data-ticket-status="idle">
        <div class="ticket-shockwave ticket-shockwave--1" aria-hidden="true"></div>
        <div class="ticket-shockwave ticket-shockwave--2" aria-hidden="true"></div>
        <span class="badge" id="ticketHeaderBadge">DEIN ZÜRI-CODE BOARDING PASS</span>
        <div class="ticket-flap-stage">
          <div class="ticket-plz" id="ticketPlz"></div>
          <div class="ticket-quarter" id="ticketQuarter"></div>
        </div>
        <div class="ticket-stamp" id="ticketReadyStamp">READY FOR PICKUP · AUSGABE OFFEN</div>
        <div style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--muted); margin-top: 0.35rem;" id="ticketMeta"></div>
        <div class="ticket-heat-bar" id="ticketHeatBar" aria-hidden="true"><div class="ticket-heat-bar__fill"></div></div>
        <div class="ticket-perf" aria-hidden="true"></div>

        <div id="ticketConnection" style="color: #FF8A80; font-size: 0.8rem; min-height: 1rem; margin-top: 0.3rem;"></div>
        <div id="ticketAlertBanner" role="status" style="margin-top: 0.6rem; padding: 0.85rem; border-radius: 12px; display: none;"></div>

        <div class="status-steps">
          <div class="status-step" id="stepCash">1. Zahlung</div>
          <div class="status-step" id="stepWok">2. Frisch im heissen Wok 🔥</div>
          <div class="status-step" id="stepPlating">3. Schöpfen &amp; Kontrolle 🍱</div>
          <div class="status-step" id="stepReady">4. ABHOLBEREIT AM TRUCK <span class="ticket-bell">🔔</span></div>
        </div>

        <div class="ticket-block" id="ticketItemsList"></div>
        <div class="ticket-block" id="ticketDeclaration" style="font-size: 0.76rem; color: var(--muted);"></div>

        <div style="display: flex; gap: 0.6rem; margin-top: 1rem;">
          <button type="button" class="mode-btn active" id="newOrderBtn" style="padding: 0.8rem;">+ Weitere Bestellung</button>
          <a href="/board" class="mode-btn" style="padding: 0.8rem; text-align: center; text-decoration: none; color: var(--ink);">Pickup Board</a>
        </div>
        <div class="page-foot">${LEGAL_LINKS_HTML}</div>
      </div>
    </div>
  </main>

  <script>
    // Prices, names and every declaration line come from the server config: one source of truth.
    const PAGE = ${pageData};
    const PRICES = Object.assign({}, PAGE.dishes, { kaiDao: PAGE.kaiDao, holyGains: PAGE.holyGains });
    const NAMES = { vegan: "Holy Vegan", chicken: "Holy Chicken", pork_mix: "Holy Pork / Mix" };
    const DRINK_NAMES = { thai_iced_tea: "Thai Iced Tea", coconut_water: "Kokoswasser", zueri_mate: "Züri Mate" };
    const SPICE_TEXT = {
      mild: "0 · ไม่เผ็ด (Nicht scharf)",
      leicht_scharf: "1 🌶️ · เผ็ดนิดหน่อย",
      original_thai_spicy: "2 🌶️🌶️ · เผ็ดมาก",
      extra_hot: "3 🔥🔥🔥 · Extra Hot"
    };
    const PAY_LABELS = { cash: "💵 Bar am Truck", twint: "📱 TWINT", card: "💳 Karte" };
    const STORAGE_KEY = "hb_active_order";
    const POLL_MS = 3000;

    let portionCount = 1;
    let builderMode = "express"; // 'express' | 'custom'
    let expressVariant = null;   // no preselection: the guest picks the card on purpose
    let expressKaiDao = false;
    let expressHolyGains = false;
    let expressSpice = "leicht_scharf";
    let customPortions = [{ variant: null, addKaiDao: false, holyGains: false, spiceLevel: "leicht_scharf" }];
    let drinks = { thai_iced_tea: 0, coconut_water: 0 };
    let paymentMethods = ["cash"];
    let paymentMethod = "cash";
    let customSpiceEnabled = Boolean(PAGE.enableCustomSpiceLevels);
    let holyGainsEnabled = Boolean(PAGE.enableHolyGains);
    let ordersPaused = false;
    let activeOrderId = null;
    let pollTimer = null;
    let lastStatus = null;
    let submitting = false;
    // One key per order attempt: a double tap or a retry after a network error never creates a second order.
    let draftKey = newDraftKey();

    function newDraftKey() {
      const rand = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now();
      return "ord_" + rand;
    }

    function esc(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
      ));
    }

    function chf(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n.toFixed(2) : "?";
    }

    function $(id) { return document.getElementById(id); }

    function storeGet() { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } }
    function storeSet(v) { try { localStorage.setItem(STORAGE_KEY, v); } catch {} }
    function storeClear() { try { localStorage.removeItem(STORAGE_KEY); } catch {} }

    // A link like /order?variant=vegan is a deliberate choice made on the landing page.
    const qVar = new URLSearchParams(window.location.search).get("variant");
    if (qVar && PAGE.variantOrder.includes(qVar) && !PAGE.blocked[qVar]) {
      expressVariant = qVar;
      customPortions[0].variant = qVar;
    }

    function currentPortions() {
      if (builderMode === "express") {
        return Array.from({ length: portionCount }, () => ({
          variant: expressVariant,
          addKaiDao: expressKaiDao,
          holyGains: holyGainsEnabled && expressHolyGains,
          spiceLevel: customSpiceEnabled ? expressSpice : "leicht_scharf"
        }));
      }
      return customPortions.map((p) => ({
        variant: p.variant,
        addKaiDao: p.addKaiDao,
        holyGains: holyGainsEnabled && p.holyGains,
        spiceLevel: customSpiceEnabled ? p.spiceLevel : "leicht_scharf"
      }));
    }

    function cartComplete() {
      const portions = currentPortions();
      return portions.length > 0 && portions.every((p) => p.variant);
    }

    // Looks up the declaration the server rendered for exactly this cart.
    function currentDeclaration() {
      const portions = currentPortions().filter((p) => p.variant);
      if (portions.length === 0) return null;
      const variants = PAGE.variantOrder.filter((v) => portions.some((p) => p.variant === v));
      const veganEgg = portions.some((p) => p.variant === "vegan" && p.addKaiDao);
      const anyEgg = portions.some((p) => p.addKaiDao);
      const egg = veganEgg ? "v" : anyEgg ? "e" : "n";
      const drinkIds = PAGE.drinkOrder.filter((d) => (drinks[d] || 0) > 0);
      return PAGE.decl.carts[variants.join("+") + "|" + egg + "|" + drinkIds.join("+")] || null;
    }

    async function loadFeatureFlags() {
      try {
        const res = await fetch("/api/features");
        const json = await res.json();
        if (!json.success) return;
        customSpiceEnabled = Boolean(json.data.features.enableCustomSpiceLevels);
        holyGainsEnabled = Boolean(json.data.features.enableHolyGains);
        if (Array.isArray(json.data.paymentMethods) && json.data.paymentMethods.length) {
          paymentMethods = json.data.paymentMethods;
          if (!paymentMethods.includes(paymentMethod)) paymentMethod = paymentMethods[0];
        }
        if (json.data.queue) {
          ordersPaused = Boolean(json.data.queue.ordersPaused);
          const badge = $("waitBadge");
          badge.textContent = "Wartezeit ca. " + json.data.queue.estimatedWaitMinutes + " Min.";
          badge.hidden = false;
        }
        renderUI();
      } catch {}
    }

    function syncCustomPortionsArray() {
      while (customPortions.length < portionCount) {
        customPortions.push({
          variant: expressVariant,
          addKaiDao: expressKaiDao,
          holyGains: expressHolyGains,
          spiceLevel: expressSpice
        });
      }
      if (customPortions.length > portionCount) {
        customPortions = customPortions.slice(0, portionCount);
      }
    }

    function computeTotal() {
      let sum = 0;
      currentPortions().forEach((p) => {
        if (p.variant) {
          sum += PRICES[p.variant] + (p.addKaiDao ? PRICES.kaiDao : 0) + (p.holyGains ? PRICES.holyGains : 0);
        }
      });
      Object.keys(drinks).forEach((d) => { sum += drinks[d] * (PAGE.drinks[d] || 0); });
      return sum;
    }

    function computePortionNutrition(p, allowGains) {
      const nut = { kcal: 0, p: 0, c: 0, f: 0 };
      if (!p || !p.variant) return nut;
      const add = (item) => {
        if (!item) return;
        nut.kcal += item.caloriesKcal;
        nut.p += item.proteinGrams;
        nut.c += item.carbsGrams;
        nut.f += item.fatGrams;
      };
      add(PAGE.nutrition[p.variant]);
      if (p.addKaiDao) add(PAGE.nutrition.kai_dao);
      if (allowGains && p.holyGains) {
        add(p.variant === "vegan" ? PAGE.nutrition.holy_gains_vegan : PAGE.nutrition.holy_gains_meat);
      }
      return nut;
    }

    function formatNutLine(n) {
      return "ca. " + n.kcal + " kcal · " + n.p + "g P · " + n.c + "g KH · " + n.f + "g F";
    }

    function computeNutrition() {
      const nut = { kcal: 0, p: 0, c: 0, f: 0 };
      const add = (item, mult) => {
        if (!item || !mult) return;
        nut.kcal += item.caloriesKcal * mult;
        nut.p += item.proteinGrams * mult;
        nut.c += item.carbsGrams * mult;
        nut.f += item.fatGrams * mult;
      };
      currentPortions().forEach((p) => {
        const pn = computePortionNutrition(p, true);
        nut.kcal += pn.kcal;
        nut.p += pn.p;
        nut.c += pn.c;
        nut.f += pn.f;
      });
      Object.keys(drinks).forEach((d) => {
        if (drinks[d] > 0) add(PAGE.nutrition[d], drinks[d]);
      });
      return nut;
    }

    function renderCustomBuilder() {
      const container = $("customBuilder");
      if (builderMode !== "custom") {
        container.style.display = "none";
        $("expressBuilder").style.display = "block";
        return;
      }
      $("expressBuilder").style.display = "none";
      container.style.display = "block";
      container.innerHTML = customPortions.map((p, idx) => {
        const gainsText = p.variant === "vegan" ? "💪 + Holy Gains (Extra Plant-Protein)" : "💪 + Holy Gains (Extra Fleisch)";
        const boxNut = computePortionNutrition(p, holyGainsEnabled);
        return '<div class="portion-box-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">' +
            '<span style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--gold);">BOX ' + (idx + 1) + ' VON ' + portionCount + '</span>' +
            (boxNut.kcal > 0 ? '<span style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--green-neon);">🔥 ' + formatNutLine(boxNut) + '</span>' : '') +
          '</div>' +
          '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem;">' +
            PAGE.variantOrder.map((v) =>
              '<button type="button" class="mode-btn ' + (p.variant === v ? 'active' : '') + '" data-cidx="' + idx + '" data-cvar="' + v + '"' +
                (PAGE.blocked[v] ? ' disabled' : '') + ' aria-pressed="' + (p.variant === v) + '">' +
                esc(NAMES[v]) + '<br>CHF ' + chf(PRICES[v]) +
              '</button>'
            ).join("") +
          '</div>' +
          '<label style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; font-size: 0.84rem; cursor: pointer;">' +
            '<input type="checkbox" ' + (p.addKaiDao ? "checked" : "") + ' data-cidx="' + idx + '" class="custom-kaidao-cb" style="width: 22px; height: 22px;">' +
            '<span>🍳 + Kai Dao (+ CHF ' + chf(PRICES.kaiDao) + ' · ca. ' + PAGE.nutrition.kai_dao.caloriesKcal + ' kcal, +' + PAGE.nutrition.kai_dao.proteinGrams + 'g P)</span>' +
          '</label>' +
          (holyGainsEnabled
            ? '<label style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.4rem; font-size: 0.84rem; cursor: pointer; color: var(--green-neon);">' +
                '<input type="checkbox" ' + (p.holyGains ? "checked" : "") + ' data-cidx="' + idx + '" class="custom-gains-cb" style="width: 22px; height: 22px;">' +
                '<span>' + gainsText + ' (+ CHF ' + chf(PRICES.holyGains) + ')</span>' +
              '</label>'
            : '') +
          (customSpiceEnabled
            ? '<div style="margin-top: 0.5rem;">' +
                '<label style="font-size: 0.76rem; color: var(--muted); display: block;">Schärfegrad Box ' + (idx + 1) + '</label>' +
                '<select class="spice-select custom-spice-sel" data-cidx="' + idx + '">' +
                  '<option value="mild"' + (p.spiceLevel === "mild" ? " selected" : "") + '>0 · ไม่เผ็ด (Nicht scharf)</option>' +
                  '<option value="leicht_scharf"' + (!p.spiceLevel || p.spiceLevel === "leicht_scharf" ? " selected" : "") + '>1 🌶️ · เผ็ดนิดหน่อย (Leicht scharf · Standard)</option>' +
                  '<option value="original_thai_spicy"' + (p.spiceLevel === "original_thai_spicy" ? " selected" : "") + '>2 🌶️🌶️ · เผ็ดมาก (Scharf)</option>' +
                '</select>' +
              '</div>'
            : '') +
        '</div>';
      }).join("");
    }

    // Event delegation: listeners survive every re-render of the box list.
    $("customBuilder").addEventListener("click", (event) => {
      const btn = event.target.closest("[data-cvar]");
      if (!btn || btn.disabled) return;
      customPortions[Number(btn.getAttribute("data-cidx"))].variant = btn.getAttribute("data-cvar");
      renderUI();
    });
    $("customBuilder").addEventListener("change", (event) => {
      const kd = event.target.closest(".custom-kaidao-cb");
      if (kd) {
        customPortions[Number(kd.getAttribute("data-cidx"))].addKaiDao = kd.checked;
        renderUI();
        return;
      }
      const hg = event.target.closest(".custom-gains-cb");
      if (hg) {
        customPortions[Number(hg.getAttribute("data-cidx"))].holyGains = hg.checked;
        renderUI();
        return;
      }
      const sp = event.target.closest(".custom-spice-sel");
      if (sp) {
        customPortions[Number(sp.getAttribute("data-cidx"))].spiceLevel = sp.value;
        renderUI();
      }
    });

    function renderDeclaration() {
      const decl = currentDeclaration();
      const block = $("declBlock");
      const pill = $("openDeclModalBtn");
      const pillText = $("declPillText");
      if (!decl) {
        // Nothing chosen yet: the general allergen notice stands in for the cart declaration.
        block.innerHTML = '<div class="decl-line--note">' + esc(PAGE.texts.allergenShort) + '</div>';
        pill.classList.remove("blocked");
        pillText.textContent = "ℹ️ Fleischherkunft, Allergene & Hinweise";
        return false;
      }
      block.innerHTML =
        (decl.b ? '<div class="decl-line--blocked">' + esc(PAGE.texts.originMissing) + '</div>' : '') +
        decl.l.map((i) => {
          const line = PAGE.decl.lines[i];
          return '<div class="decl-line--' + line.k + '">' + esc(line.t) + '</div>';
        }).join("");
      pill.classList.toggle("blocked", decl.b);
      const firstLine = decl.b ? PAGE.texts.originMissing : (PAGE.decl.lines[decl.l[0]] && PAGE.decl.lines[decl.l[0]].t) || "Allergene & Herkunft";
      pillText.textContent = (decl.b ? "⚠️ " : "ℹ️ ") + firstLine;
      return decl.b;
    }

    function renderUI() {
      syncCustomPortionsArray();
      $("portionCountDisplay").textContent = String(portionCount);
      $("btnDecPortion").disabled = portionCount <= 1;
      $("btnIncPortion").disabled = portionCount >= PAGE.maxPortions;

      $("groupModeSwitch").style.display = portionCount > 1 ? "flex" : "none";
      if (portionCount === 1) builderMode = "express";
      $("modeExpressBtn").classList.toggle("active", builderMode === "express");
      $("modeCustomBtn").classList.toggle("active", builderMode === "custom");

      document.querySelectorAll("#expressVariantGrid .variant-btn").forEach((b) => {
        const on = b.getAttribute("data-variant") === expressVariant;
        b.classList.toggle("selected", on);
        b.setAttribute("aria-pressed", String(on));
      });
      $("expressKaiDaoBtn").classList.toggle("checked", expressKaiDao);
      $("expressKaiDaoBtn").setAttribute("aria-pressed", String(expressKaiDao));

      const hgBtn = $("expressHolyGainsBtn");
      hgBtn.style.display = holyGainsEnabled ? "flex" : "none";
      hgBtn.classList.toggle("checked", expressHolyGains);
      hgBtn.setAttribute("aria-pressed", String(expressHolyGains));
      $("expressHolyGainsLabel").textContent = expressVariant === "vegan"
        ? "💪 + Holy Gains (Extra Plant-Protein)"
        : "💪 + Holy Gains (Extra Fleisch)";
      $("expressHolyGainsSub").textContent = expressVariant === "vegan"
        ? "+ ca. 180 kcal · +20g Protein (Bio-Soja- & Pilz-Mince)"
        : "+ ca. 210 kcal · +28g Protein (Extra Fleisch)";

      $("expressSpiceContainer").style.display = customSpiceEnabled ? "block" : "none";

      renderCustomBuilder();

      $("drink_thai_iced_tea").textContent = String(drinks.thai_iced_tea);
      $("drink_coconut_water").textContent = String(drinks.coconut_water);
      const drinkCount = drinks.thai_iced_tea + drinks.coconut_water;
      $("drinksSummary").textContent = drinkCount > 0 ? drinkCount + " gewählt" : "";
      $("plzSummary").textContent = $("prefPlzSelect").value;

      const nut = computeNutrition();
      const nutBox = $("nutritionSummaryBox");
      if (nut.kcal > 0) {
        nutBox.style.display = "block";
        const portions = currentPortions();
        let nutHtml = "";
        if (portions.length > 1) {
          if (builderMode === "express" && portions[0].variant) {
            const single = computePortionNutrition(portions[0], holyGainsEnabled);
            nutHtml += '<div style="font-size:0.78rem;color:var(--ink);margin-bottom:0.25rem;">Pro Portion: ' + esc(formatNutLine(single)) + '</div>';
          } else {
            const boxLines = portions.map((p, idx) => {
              const bn = computePortionNutrition(p, holyGainsEnabled);
              return bn.kcal > 0
                ? '<div style="font-size:0.76rem;color:var(--ink);">Box ' + (idx + 1) + ' (' + esc(NAMES[p.variant]) + '): ' + esc(formatNutLine(bn)) + '</div>'
                : '';
            }).filter(Boolean).join("");
            if (boxLines) nutHtml += '<div style="margin-bottom:0.3rem;">' + boxLines + '</div>';
          }
        }
        nutHtml += "<div>🔥 Gesamt: ca. " + nut.kcal + " kcal · " + nut.p + "g Protein · " + nut.c + "g KH · " + nut.f + "g Fett</div>";
        $("nutritionValsText").innerHTML = nutHtml;
      } else {
        nutBox.style.display = "none";
      }

      const payGrid = $("paymentGrid");
      if (paymentMethods.length > 1) {
        const payHtml = paymentMethods.map((m) =>
          '<button type="button" class="pay-btn ' + (m === paymentMethod ? 'selected' : '') + '" data-pay="' + esc(m) + '" aria-pressed="' + (m === paymentMethod) + '">' + esc(PAY_LABELS[m] || m) + '</button>'
        ).join("");
        if (payGrid.dataset.html !== payHtml) {
          payGrid.dataset.html = payHtml;
          payGrid.innerHTML = payHtml;
        }
        payGrid.style.display = "flex";
      } else {
        payGrid.style.display = "none";
      }

      const blocked = renderDeclaration();
      const btn = $("submitOrderBtn");
      const total = "CHF " + computeTotal().toFixed(2);
      $("pausedNotice").hidden = !ordersPaused;
      if (ordersPaused) {
        btn.disabled = true;
        btn.textContent = "Bestellannahme pausiert";
      } else if (!cartComplete()) {
        btn.disabled = true;
        btn.textContent = builderMode === "custom" ? "Variante für jede Box wählen" : "Variante wählen";
      } else if (blocked) {
        btn.disabled = true;
        btn.textContent = "Nicht bestellbar";
      } else {
        btn.disabled = submitting;
        btn.textContent = paymentMethod === "cash"
          ? "Bestellen · " + total + " · bar am Truck"
          : "Jetzt zahlen · " + total;
      }
      syncFooterHeight();
    }

    // The page content always ends above the fixed checkout bar.
    function syncFooterHeight() {
      const h = $("checkoutBar").offsetHeight;
      if (h > 0) document.documentElement.style.setProperty("--footer-h", (h + 16) + "px");
    }
    if (window.ResizeObserver) new ResizeObserver(syncFooterHeight).observe($("checkoutBar"));

    function openDeclModal() {
      $("declarationModal").hidden = false;
      document.body.style.overflow = "hidden";
    }
    function closeDeclModal() {
      $("declarationModal").hidden = true;
      document.body.style.overflow = "";
    }
    $("openDeclModalBtn").addEventListener("click", openDeclModal);
    $("closeDeclModalBtn").addEventListener("click", closeDeclModal);
    $("closeDeclModalFooterBtn").addEventListener("click", closeDeclModal);
    $("declarationModal").addEventListener("click", (e) => {
      if (e.target === $("declarationModal")) closeDeclModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("declarationModal").hidden) closeDeclModal();
    });

    $("btnDecPortion").addEventListener("click", () => {
      if (portionCount > 1) { portionCount--; renderUI(); }
    });
    $("btnIncPortion").addEventListener("click", () => {
      if (portionCount < PAGE.maxPortions) { portionCount++; renderUI(); }
    });
    $("modeExpressBtn").addEventListener("click", () => { builderMode = "express"; renderUI(); });
    $("modeCustomBtn").addEventListener("click", () => { builderMode = "custom"; renderUI(); });

    document.querySelectorAll("#expressVariantGrid .variant-btn").forEach((b) => {
      b.addEventListener("click", () => {
        expressVariant = b.getAttribute("data-variant");
        $("orderErrorMsg").textContent = "";
        renderUI();
      });
    });

    $("expressKaiDaoBtn").addEventListener("click", () => {
      expressKaiDao = !expressKaiDao;
      renderUI();
    });

    $("expressHolyGainsBtn").addEventListener("click", () => {
      expressHolyGains = !expressHolyGains;
      renderUI();
    });

    $("expressSpiceSelect").addEventListener("change", (e) => {
      expressSpice = e.target.value;
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
    $("prefPlzSelect").addEventListener("change", renderUI);

    $("paymentGrid").addEventListener("click", (event) => {
      const btn = event.target.closest("[data-pay]");
      if (!btn) return;
      paymentMethod = btn.getAttribute("data-pay");
      renderUI();
    });

    $("submitOrderBtn").addEventListener("click", async () => {
      if (submitting || !cartComplete()) return;
      const errEl = $("orderErrorMsg");
      errEl.textContent = "";

      const portionsPayload = currentPortions().map((p) => ({
        variant: p.variant,
        spiceLevel: p.spiceLevel || "leicht_scharf",
        addKaiDao: Boolean(p.addKaiDao),
        ...(holyGainsEnabled && p.holyGains ? { holyGains: true } : {})
      }));
      const drinksPayload = Object.entries(drinks)
        .filter(([, q]) => q > 0)
        .map(([drinkId, quantity]) => ({ drinkId, quantity }));
      const preferredPlz = $("prefPlzSelect").value || undefined;

      submitting = true;
      renderUI();
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": draftKey },
          body: JSON.stringify({ portions: portionsPayload, drinks: drinksPayload, paymentMethod, preferredPlz })
        });
        const json = await res.json();
        if (!json.success) {
          errEl.textContent = (json.error && json.error.message) || "Bestellung konnte nicht gesendet werden.";
          if (json.error && json.error.code === "ORDERS_PAUSED") ordersPaused = true;
          return;
        }
        draftKey = newDraftKey();
        const order = json.data.order;
        if (order.paymentUrl) {
          // Digital payment: remember the ticket, then go to the payment page.
          storeSet(order.id);
          window.location.href = order.paymentUrl;
          return;
        }
        showLiveTicket(order);
      } catch (e) {
        errEl.textContent = "Keine Verbindung. Tippe nochmals auf Bestellen: Es wird nichts doppelt gebucht.";
      } finally {
        submitting = false;
        renderUI();
      }
    });

    function stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }

    function startPolling() {
      stopPolling();
      pollTimer = setInterval(pollTicket, POLL_MS);
    }

    async function pollTicket() {
      if (!activeOrderId) return;
      try {
        const r = await fetch("/api/orders/" + encodeURIComponent(activeOrderId));
        const j = await r.json();
        $("ticketConnection").textContent = "";
        if (j.success && j.data.order) {
          renderTicketState(j.data.order, j.data.queue);
        }
      } catch {
        $("ticketConnection").textContent = "Keine Verbindung. Dein Code bleibt gültig.";
      }
    }

    // A locked or backgrounded phone does not poll; it catches up the moment it comes back.
    document.addEventListener("visibilitychange", () => {
      if (!activeOrderId) return;
      if (document.hidden) {
        stopPolling();
      } else {
        pollTicket();
        startPolling();
      }
    });

    function showLiveTicket(order, queue) {
      activeOrderId = order.id;
      // The ticket lives in the URL and in localStorage: a reload or a locked phone does not lose it.
      storeSet(order.id);
      try { history.replaceState(null, "", "/order/" + encodeURIComponent(order.id)); } catch {}
      $("orderBuilderView").style.display = "none";
      $("liveTicketView").style.display = "block";
      window.scrollTo(0, 0);
      startPolling();
      renderTicketState(order, queue);
    }

    function setBanner(kind, html) {
      const el = $("ticketAlertBanner");
      if (!kind) { el.style.display = "none"; return; }
      const styles = {
        gold: ["rgba(255, 213, 79, 0.16)", "1.5px solid var(--gold)", "var(--gold)"],
        red: ["rgba(229, 57, 53, 0.2)", "1.5px solid var(--chili)", "#FFCDD2"],
        green: ["rgba(82, 196, 90, 0.25)", "2px solid var(--green-neon)", "#F5F7F5"]
      }[kind];
      el.style.display = "block";
      el.style.background = styles[0];
      el.style.border = styles[1];
      el.style.color = styles[2];
      if (el.dataset.html !== html) {
        el.dataset.html = html;
        el.innerHTML = html;
      }
    }

    // Synthesize a clean two-tone street-bell chime when transitioning from IN_WOK to READY_FOR_PICKUP
    function playPickupChime() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        [587.33, 880].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.14);
          gain.gain.setValueAtTime(0.001, now + idx * 0.14);
          gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.14 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.42);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.14);
          osc.stop(now + idx * 0.14 + 0.45);
        });
      } catch {}
    }

    // Outdoor Sunlight Contrast Mode Toggle (persisted in localStorage)
    const sunlightBtn = $("sunlightToggleBtn");
    if (sunlightBtn) {
      const applySunlight = (on) => {
        if (on) {
          document.documentElement.setAttribute("data-sunlight", "high");
        } else {
          document.documentElement.removeAttribute("data-sunlight");
        }
        sunlightBtn.setAttribute("aria-pressed", on ? "true" : "false");
      };
      try {
        if (localStorage.getItem("hb_sunlight_mode") === "high") applySunlight(true);
      } catch {}
      sunlightBtn.addEventListener("click", () => {
        const next = document.documentElement.getAttribute("data-sunlight") !== "high";
        applySunlight(next);
        try { localStorage.setItem("hb_sunlight_mode", next ? "high" : "normal"); } catch {}
      });
    }

    function renderTicketState(order, queue) {
      const code = esc(order.zueriCode.formatted);
      const total = "CHF " + chf(order.totalChf);
      $("ticketPlz").textContent = order.zueriCode.plz;
      $("ticketQuarter").textContent = order.zueriCode.quarter;
      $("ticketMeta").textContent =
        order.totalPortions + (order.totalPortions === 1 ? " Portion" : " Portionen") + " · " + total + " · " +
        (order.paymentMethod === "cash" ? "BAR" : String(order.paymentMethod).toUpperCase());

      const cardBox = $("ticketCardBox");
      const isCooking = order.status === "received" || order.status === "in_wok" || order.status === "plating";
      const isReady = order.status === "ready";
      cardBox.setAttribute("data-ticket-status", order.status);
      cardBox.classList.toggle("is-cooking", isCooking);
      cardBox.classList.toggle("is-ready", isReady);

      const headerBadge = $("ticketHeaderBadge");
      if (headerBadge) {
        headerBadge.textContent = isReady
          ? "🔔 READY FOR PICKUP · AUSGABE"
          : isCooking
            ? "🔥 LIVE IM WOK · BOARDING PASS"
            : "DEIN ZÜRI-CODE BOARDING PASS";
      }

      if (isReady && lastStatus !== "ready") {
        cardBox.classList.remove("is-transitioning-ready");
        void cardBox.offsetWidth;
        cardBox.classList.add("is-transitioning-ready");
        if (navigator.vibrate) {
          try { navigator.vibrate([220, 90, 260, 90, 320]); } catch {}
        }
        playPickupChime();
      }
      lastStatus = order.status;

      const wait = queue && queue.estimatedWaitMinutes ? " Aktuelle Wartezeit ca. " + esc(queue.estimatedWaitMinutes) + " Min." : "";
      if (order.status === "pending_cash") {
        setBanner("gold", "💵 <strong>Jetzt an der Kasse bezahlen:</strong> Nenne deinen Code <strong>" + code + "</strong> und zahle <strong>" + total + "</strong>. Erst dann geht deine Bestellung in den Wok.");
      } else if (order.status === "pending_payment") {
        setBanner("gold", "⏳ <strong>Zahlung noch offen.</strong> Sobald sie bestätigt ist, geht deine Bestellung in den Wok." +
          (order.paymentUrl ? '<a class="ticket-pay-link" href="' + esc(order.paymentUrl) + '">Jetzt ' + total + " zahlen</a>" : "") +
          '<div style="margin-top:0.5rem;font-size:0.82rem;">Oder bar an der Kasse mit Code <strong>' + code + "</strong>.</div>");
      } else if (order.status === "payment_error_fallback") {
        setBanner("red", "⚠️ <strong>Zahlung nicht bestätigt.</strong> Dein Code <strong>" + code + "</strong> ist reserviert. Bitte kurz an der Kasse melden.");
      } else if (order.status === "received" || order.status === "in_wok" || order.status === "plating") {
        setBanner("green", "✓ <strong>Bezahlt.</strong> Wir rufen deinen Code auf, sobald deine Box bereit ist." + wait);
      } else if (order.status === "ready") {
        setBanner("green", "🔔 <strong>DEIN PAD KRAPAO IST ABHOLBEREIT!</strong> Komm jetzt mit deinem Code <strong>" + code + "</strong> zur Ausgabe!");
      } else if (order.status === "completed") {
        setBanner("green", "✓ <strong>Abgeholt.</strong> En Guete!");
      } else if (order.status === "cancelled") {
        setBanner("red", "<strong>Diese Bestellung wurde storniert.</strong> Fragen? Melde dich an der Kasse.");
      } else {
        setBanner(null);
      }

      const steps = { cash: $("stepCash"), wok: $("stepWok"), plating: $("stepPlating"), ready: $("stepReady") };
      Object.values(steps).forEach((el) => { el.className = "status-step"; });
      if (order.status === "pending_cash" || order.status === "pending_payment") {
        steps.cash.classList.add("cash-wait");
      } else if (order.status === "payment_error_fallback") {
        steps.cash.classList.add("error-wait");
      } else if (order.status === "received" || order.status === "in_wok") {
        steps.cash.classList.add("is-done");
        steps.wok.classList.add("active");
      } else if (order.status === "plating") {
        steps.cash.classList.add("is-done");
        steps.wok.classList.add("is-done");
        steps.plating.classList.add("active");
      } else if (order.status === "ready" || order.status === "completed") {
        steps.cash.classList.add("is-done");
        steps.wok.classList.add("is-done");
        steps.plating.classList.add("is-done");
        steps.ready.classList.add("active");
      }

      const ticketNut = { kcal: 0, p: 0, c: 0, f: 0 };
      const addTicketNut = (item, mult) => {
        if (!item || !mult) return;
        ticketNut.kcal += item.caloriesKcal * mult;
        ticketNut.p += item.proteinGrams * mult;
        ticketNut.c += item.carbsGrams * mult;
        ticketNut.f += item.fatGrams * mult;
      };
      order.portions.forEach((p) => {
        addTicketNut(PAGE.nutrition[p.variant], 1);
        if (p.addKaiDao) addTicketNut(PAGE.nutrition.kai_dao, 1);
        if (p.holyGains) addTicketNut(p.variant === "vegan" ? PAGE.nutrition.holy_gains_vegan : PAGE.nutrition.holy_gains_meat, 1);
      });
      (order.drinks || []).forEach((d) => addTicketNut(PAGE.nutrition[d.drinkId], d.quantity));

      const itemsHtml = order.portions.map((p) => {
        const bn = computePortionNutrition(p, true);
        return '<div>• Box ' + esc(p.portionIndex) + ': <strong>' + esc(NAMES[p.variant] || p.variant) + '</strong>' +
          (p.addKaiDao ? " + Kai Dao 🍳" : "") +
          (p.holyGains ? " + Holy Gains 💪" : "") +
          ' · <em>' + esc(SPICE_TEXT[p.spiceLevel] || p.spiceLevel) + '</em>' +
          (bn.kcal > 0 ? '<div style="font-family:var(--font-mono);font-size:0.7rem;color:var(--muted);margin-left:0.85rem;">↳ ' + esc(formatNutLine(bn)) + '</div>' : '') +
        '</div>';
      }).join("") + (order.drinks.length
        ? "<div style='margin-top:0.4rem;color:var(--gold);'>Drinks: " + order.drinks.map((d) => esc(d.quantity) + "x " + esc(DRINK_NAMES[d.drinkId] || d.drinkId)).join(", ") + "</div>"
        : "") +
        '<div style="margin-top:0.5rem;padding-top:0.4rem;border-top:1px solid rgba(255,255,255,0.1);font-family:var(--font-mono);font-size:0.74rem;color:var(--green-neon);">' +
          '🔥 Gesamt-Schätzwert: ca. ' + ticketNut.kcal + ' kcal · ' + ticketNut.p + 'g P · ' + ticketNut.c + 'g KH · ' + ticketNut.f + 'g F' +
        '</div>' +
        '<div style="font-size:0.68rem;color:var(--muted);">Unverbindliche Schätzwerte (Wok-Zubereitung).</div>';
      if ($("ticketItemsList").dataset.html !== itemsHtml) {
        $("ticketItemsList").dataset.html = itemsHtml;
        $("ticketItemsList").innerHTML = itemsHtml;
      }

      // The declaration the guest saw before ordering, repeated as stored on the order.
      const declEl = $("ticketDeclaration");
      if (order.declaration && order.declaration.lines && order.declaration.lines.length) {
        const declHtml = order.declaration.lines.map((l) => "<div>" + esc(l) + "</div>").join("") +
          '<div style="margin-top:0.3rem;">Deklaration Version ' + esc(order.declaration.version) + "</div>";
        if (declEl.dataset.html !== declHtml) {
          declEl.dataset.html = declHtml;
          declEl.innerHTML = declHtml;
        }
        declEl.style.display = "block";
      } else {
        declEl.style.display = "none";
      }

      // Finished orders need no more polling.
      if (order.status === "completed" || order.status === "cancelled") {
        stopPolling();
        storeClear();
      }
    }

    function showBuilder() {
      activeOrderId = null;
      lastStatus = null;
      stopPolling();
      storeClear();
      try { history.replaceState(null, "", "/order"); } catch {}
      $("liveTicketView").style.display = "none";
      $("orderBuilderView").style.display = "block";
      loadFeatureFlags();
      syncFooterHeight();
    }

    $("newOrderBtn").addEventListener("click", showBuilder);

    // Restore a ticket from /order/<id> or from the last order on this phone.
    async function restoreTicket() {
      const match = window.location.pathname.match(/^\\/order\\/([A-Za-z0-9_-]+)$/);
      const id = match ? match[1] : storeGet();
      if (!id) return;
      try {
        const r = await fetch("/api/orders/" + encodeURIComponent(id));
        const j = await r.json();
        if (j.success && j.data.order) {
          const finished = j.data.order.status === "completed" || j.data.order.status === "cancelled";
          if (finished && !match) { storeClear(); return; }
          showLiveTicket(j.data.order, j.data.queue);
          return;
        }
        if (r.status === 404) showBuilder();
      } catch {}
    }

    renderUI();
    loadFeatureFlags();
    restoreTicket();
  </script>
</body>
</html>`;
}
