/**
 * Legal master data for /impressum and /datenschutz and the newsletter consent text.
 *
 * Values in [SQUARE BRACKETS] are PLACEHOLDERS. Replace them before going live and have
 * the texts reviewed by a lawyer. The server prints a warning at start while placeholders
 * remain, and both pages show a draft notice.
 */

export interface LegalConfig {
  updatedAt: string;
  company: {
    name: string;
    legalForm: string;
    street: string;
    zipCity: string;
    country: string;
    uid: string;
    representative: string;
    email: string;
    phone: string;
  };
  privacyContact: string;
  hostingProvider: string;
  paymentProvider: string;
  mailProvider: string;
  /** How long finished orders and unanswered B2B inquiries are kept. */
  retention: { orders: string; b2b: string; serverLogs: string };
}

export const legalConfig: LegalConfig = {
  updatedAt: '2026-11-15',
  company: {
    name: '[FIRMENNAME]',
    legalForm: '[RECHTSFORM, z. B. GmbH]',
    street: '[STRASSE NR.]',
    zipCity: '[PLZ ORT]',
    country: 'Schweiz',
    uid: '[UID CHE-000.000.000]',
    representative: '[VERTRETUNGSBERECHTIGTE PERSON]',
    email: '[KONTAKT-E-MAIL]',
    phone: '[TELEFON]',
  },
  privacyContact: '[E-MAIL FÜR DATENSCHUTZANFRAGEN]',
  hostingProvider: '[HOSTING-ANBIETER, LAND]',
  paymentProvider: '[ZAHLUNGSANBIETER, LAND – noch nicht angebunden]',
  mailProvider: '[E-MAIL-VERSANDANBIETER, LAND – noch nicht angebunden]',
  retention: {
    orders: '[AUFBEWAHRUNGSDAUER BESTELLUNGEN, z. B. 10 Jahre gemäss Buchführungspflicht]',
    b2b: '[AUFBEWAHRUNGSDAUER ANFRAGEN, z. B. 12 Monate]',
    serverLogs: '[AUFBEWAHRUNGSDAUER SERVER-LOGS, z. B. 30 Tage]',
  },
};

/** The text a person agrees to when subscribing. Stored with every subscription as evidence. */
export const NEWSLETTER_CONSENT = {
  version: '2026-11-15.1',
  text:
    'Ich möchte den Holy Basil Tour-Alert per E-Mail erhalten (Standorte und Pop-ups, höchstens ' +
    'einmal pro Woche). Die Anmeldung gilt erst nach Klick auf den Bestätigungslink. ' +
    'Abmelden ist jederzeit über den Link in jeder E-Mail möglich.',
} as const;

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
}

/** Placeholders that still have to be replaced before going live. */
export function getLegalPlaceholders(config: LegalConfig = legalConfig): string[] {
  const all: string[] = [];
  collectStrings(config, all);
  return all.filter((s) => /\[[^\]]+\]/.test(s));
}
