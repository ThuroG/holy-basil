import crypto from 'node:crypto';
import { NewsletterSubscriber } from './types.js';
import { readJson, writeJsonAtomic } from './storage.js';
import { getMailer } from './mailer.js';
import { NEWSLETTER_CONSENT } from '../config/legal.js';

/**
 * Tour newsletter with double opt-in.
 *
 *   1. requestSubscription(): stores the address as `pending` and mails a confirmation link.
 *      The answer to the caller is always the same, whether the address is new, pending or
 *      already confirmed, so nobody can find out who is subscribed.
 *   2. confirmSubscription(token): the link is valid for 48 hours and works once.
 *      Only the SHA-256 of the token is stored.
 *   3. unsubscribe(token): deletes the record. Unconfirmed records are deleted after 48 hours.
 */

export const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

let subscribers: NewsletterSubscriber[] = [];

function persist(): void {
  writeJsonAtomic('subscribers', subscribers);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function loadNewsletterFromDisk(): number {
  const stored = readJson<NewsletterSubscriber[]>('subscribers', []);
  // Records from before the double opt-in have no consent evidence: they are not carried over.
  subscribers = Array.isArray(stored)
    ? stored.filter((s) => s && typeof s.email === 'string' && s.consent && s.unsubscribeToken)
    : [];
  return subscribers.length;
}

export interface SubscriptionRequest {
  email?: unknown;
  preferredPlz?: unknown;
  preferredQuarter?: unknown;
}

/**
 * Starts (or restarts) a subscription. Throws INVALID_EMAIL for a malformed address;
 * everything else ends in the same silent success.
 */
export async function requestSubscription(
  input: SubscriptionRequest,
  baseUrl: string,
  now: number = Date.now()
): Promise<void> {
  const email = cleanText(input?.email, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('INVALID_EMAIL');
  }
  const preferredPlz = cleanText(input.preferredPlz, 10);
  const preferredQuarter = cleanText(input.preferredQuarter, 40);

  let subscriber = subscribers.find((s) => s.email === email);
  if (subscriber && subscriber.status === 'confirmed') {
    // Already subscribed: keep the preferences up to date, send nothing.
    if (preferredPlz) subscriber.preferredPlz = preferredPlz;
    if (preferredQuarter) subscriber.preferredQuarter = preferredQuarter;
    persist();
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const requestedAt = new Date(now).toISOString();
  if (!subscriber) {
    subscriber = {
      id: `sub_${crypto.randomBytes(8).toString('hex')}`,
      email,
      preferredPlz,
      preferredQuarter,
      createdAt: requestedAt,
      status: 'pending',
      unsubscribeToken: crypto.randomBytes(32).toString('hex'),
      consent: { textVersion: NEWSLETTER_CONSENT.version, text: NEWSLETTER_CONSENT.text, requestedAt },
    };
    subscribers.unshift(subscriber);
  } else {
    if (preferredPlz) subscriber.preferredPlz = preferredPlz;
    if (preferredQuarter) subscriber.preferredQuarter = preferredQuarter;
    subscriber.consent = {
      textVersion: NEWSLETTER_CONSENT.version,
      text: NEWSLETTER_CONSENT.text,
      requestedAt,
    };
  }
  subscriber.confirmTokenHash = hashToken(token);
  subscriber.confirmExpiresAt = new Date(now + CONFIRM_TTL_MS).toISOString();
  persist();

  const base = baseUrl.replace(/\/+$/, '');
  await getMailer().send({
    to: email,
    subject: 'Holy Basil Tour-Alert: Bitte Anmeldung bestätigen',
    text: [
      'Hoi!',
      '',
      'Bitte bestätige deine Anmeldung für den Holy Basil Tour-Alert:',
      `${base}/newsletter/confirm?token=${token}`,
      '',
      'Der Link ist 48 Stunden gültig. Hast du dich nicht angemeldet? Dann ignoriere diese',
      'E-Mail einfach: Ohne Bestätigung erhältst du nichts von uns und die Adresse wird gelöscht.',
      '',
      `Abmelden: ${base}/newsletter/unsubscribe?token=${subscriber.unsubscribeToken}`,
    ].join('\n'),
  });
}

export type ConfirmResult = 'confirmed' | 'invalid';

export function confirmSubscription(token: unknown, now: number = Date.now()): ConfirmResult {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return 'invalid';
  const hash = hashToken(token);
  const subscriber = subscribers.find((s) => s.confirmTokenHash === hash);
  if (!subscriber || !subscriber.confirmExpiresAt) return 'invalid';
  if (Date.parse(subscriber.confirmExpiresAt) < now) return 'invalid';
  subscriber.status = 'confirmed';
  subscriber.confirmedAt = new Date(now).toISOString();
  delete subscriber.confirmTokenHash;
  delete subscriber.confirmExpiresAt;
  persist();
  return 'confirmed';
}

/** Deletes the subscription. Returns false for an unknown token. */
export function unsubscribe(token: unknown): boolean {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return false;
  const before = subscribers.length;
  subscribers = subscribers.filter((s) => s.unsubscribeToken !== token);
  if (subscribers.length === before) return false;
  persist();
  return true;
}

/** Deletes requests nobody confirmed in time. */
export function purgeExpiredPendingSubscriptions(now: number = Date.now()): number {
  const before = subscribers.length;
  subscribers = subscribers.filter(
    (s) =>
      s.status === 'confirmed' ||
      (s.confirmExpiresAt !== undefined && Date.parse(s.confirmExpiresAt) >= now)
  );
  const removed = before - subscribers.length;
  if (removed > 0) persist();
  return removed;
}

export function getNewsletterSubscribers(): NewsletterSubscriber[] {
  return [...subscribers];
}

/** What the crew sees: no tokens. */
export function getNewsletterOverview() {
  return subscribers.map((s) => ({
    id: s.id,
    email: s.email,
    preferredPlz: s.preferredPlz,
    preferredQuarter: s.preferredQuarter,
    status: s.status,
    createdAt: s.createdAt,
    confirmedAt: s.confirmedAt,
    consentTextVersion: s.consent.textVersion,
  }));
}

export function resetNewsletter(): void {
  subscribers = [];
}
