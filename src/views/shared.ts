/** Small pieces every page shares. */

/** Fonts come from this server (/fonts/*), never from a font CDN. Preload critical weights for 0 CLS. */
export const FONT_LINK =
  '<link rel="preload" href="/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>' +
  '<link rel="preload" href="/fonts/jetbrains-mono-latin.woff2" as="font" type="font/woff2" crossorigin>' +
  '<link rel="stylesheet" href="/fonts/fonts.css">';

/** Transparent SVG brand assets so no black rectangle (#0A0A0A) shows on elevated surfaces. */
export const LOGO_STICKER_TRANSPARENT =
  '/assets/holy_basil_logo_v7_team_stacked_sticker_transparent.svg';
export const LOGO_EMBLEM_TRANSPARENT =
  '/assets/holy_basil_logo_v7_team_emblem_transparent.svg';
export const LOGO_TYPO_TRANSPARENT =
  '/assets/holy_basil_logo_v7_team_emblem_typography_only_transparent.svg';
export const LOGO_TYPO_TAGLINE_TRANSPARENT =
  '/assets/holy_basil_logo_v7_team_emblem_typography_with_tagline_transparent.svg';

/**
 * Unverhandelbares Design-System gemäss README_DESIGN.md + Outdoor Sunlight Contrast Tuning.
 *
 * WCAG 2.1 Kontrast-Audit (Rel. Luminanz auf #0A0A0A [L=0.003] / #161816 [L=0.0086]):
 * - #F5F7F5 (Chalk White):     18.37:1 auf #0A0A0A | 16.63:1 auf #161816 (AAA)
 * - #FFD54F (Street Gold):     13.88:1 auf #0A0A0A | 12.57:1 auf #161816 (AAA)
 * - #69F0AE (Sunlight Herb):   12.62:1 auf #0A0A0A | 11.42:1 auf #161816 (AAA+ Outdoor Micro-Copy)
 * - #52C45A (Neon Herb):        8.86:1 auf #0A0A0A |  8.03:1 auf #161816 (AAA)
 * - #B8C4B9 (Sunlight Grey):   11.01:1 auf #0A0A0A |  9.97:1 auf #161816 (AAA+ Outdoor Secondary)
 * - #9EA79E (Concrete Grey):    7.99:1 auf #0A0A0A |  7.24:1 auf #161816 (AAA Indoor, 6.43:1 auf #1F2420)
 * - #E53935 (Chili Red):        4.36:1 auf #0A0A0A -> Nur für Icons/Rahmen! Text nutzt #FF8A80 (9.9:1).
 */
export const DESIGN_TOKENS_CSS = `
    :root {
      --bg-primary: #0A0A0A;
      --bg-elevated: #161816;
      --bg-surface: #1F2420;
      --green-deep: #1B4D2E;
      --green-core: #2E7D32;
      --green-highlight: #52C45A;
      --green-sunlight: #69F0AE;
      --halo-accent: #FFD54F;
      --chili-accent: #E53935;
      --chili-readable: #FF8A80;
      --text-primary: #F5F7F5;
      --text-secondary: #B8C4B9;
      --text-muted-indoor: #9EA79E;
      --border-bold: 2.5px solid #52C45A;
      --border-subtle: 1.5px solid rgba(82, 196, 90, 0.45);
      /* Aliases for view compatibility */
      --bg: var(--bg-primary);
      --surface: var(--bg-elevated);
      --surface-2: var(--bg-surface);
      --green-neon: var(--green-highlight);
      --gold: var(--halo-accent);
      --chili: var(--chili-accent);
      --ink: var(--text-primary);
      --muted: var(--text-secondary);
      --font-display: "Space Grotesk", system-ui, sans-serif;
      --font-body: "Plus Jakarta Sans", "Space Grotesk", system-ui, sans-serif;
      --font-mono: "JetBrains Mono", ui-monospace, monospace;
    }
    @media (prefers-contrast: more) {
      :root {
        --bg-elevated: #0E110E;
        --bg-surface: #141915;
        --green-highlight: #69F0AE;
        --text-primary: #FFFFFF;
        --text-secondary: #DCE5DD;
        --border-subtle: 2px solid #69F0AE;
      }
    }
    [data-sunlight="high"] {
      --bg-elevated: #0C0F0C;
      --bg-surface: #121713;
      --green-highlight: #69F0AE;
      --green-neon: #69F0AE;
      --text-primary: #FFFFFF;
      --text-secondary: #DCE5DD;
      --muted: #DCE5DD;
      --border-subtle: 2px solid #69F0AE;
    }`;

export function escHtml(value: unknown): string {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

/** JSON that is safe inside a <script> block. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export const LEGAL_LINKS_HTML =
  '<a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a>';
