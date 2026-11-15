/** Small pieces every page shares. */

/** Fonts come from this server (/fonts/*), never from a font CDN. */
export const FONT_LINK = '<link rel="stylesheet" href="/fonts/fonts.css">';

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
