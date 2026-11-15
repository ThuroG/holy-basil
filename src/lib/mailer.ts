import { readJson, writeJsonAtomic } from './storage.js';

/**
 * Outgoing e-mail behind one small interface.
 *
 * Today only the MOCK mailer exists: it sends nothing. Every message lands in
 * data/outbox.json and, outside of tests, in the server console, so the double opt-in
 * can be tried end to end. To go live, add a mailer for the real provider (e.g. Brevo
 * or SMTP) that implements `Mailer` and return it from `getMailer()`.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  name: string;
  send(message: MailMessage): Promise<void>;
}

export interface OutboxEntry extends MailMessage {
  sentAt: string;
}

const MAX_OUTBOX = 200;
let outbox: OutboxEntry[] | null = null;

function loadOutbox(): OutboxEntry[] {
  if (outbox === null) {
    const stored = readJson<OutboxEntry[]>('outbox', []);
    outbox = Array.isArray(stored) ? stored : [];
  }
  return outbox;
}

const mockMailer: Mailer = {
  name: 'mock',
  async send(message) {
    const list = loadOutbox();
    list.unshift({ ...message, sentAt: new Date().toISOString() });
    if (list.length > MAX_OUTBOX) list.length = MAX_OUTBOX;
    writeJsonAtomic('outbox', list);
    if (process.env.VITEST !== 'true') {
      console.log(
        `[holy-basil] MOCK-MAIL (nicht versendet) an ${message.to}: ${message.subject}\n${message.text}\n`
      );
    }
  },
};

export function getMailer(): Mailer {
  return mockMailer;
}

/** Messages the mock mailer "sent", newest first. For tests and local trials. */
export function getOutbox(): OutboxEntry[] {
  return [...loadOutbox()];
}

export function resetOutbox(): void {
  outbox = [];
}
