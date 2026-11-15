import { legalConfig, getLegalPlaceholders, NEWSLETTER_CONSENT } from '../config/legal.js';
import { FONT_LINK, escHtml } from './shared.js';

/**
 * /impressum and /datenschutz. All company data comes from src/config/legal.ts.
 * The texts are a DRAFT for legal review, not legal advice.
 */

function page(title: string, body: string): string {
  const draft =
    getLegalPlaceholders().length > 0
      ? '<div class="draft">ENTWURF: Diese Seite enthält Platzhalter in [eckigen Klammern] und ist juristisch noch nicht geprüft.</div>'
      : '';
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HOLY BASIL · ${escHtml(title)}</title>
  <link rel="icon" href="/assets/holy_basil_logo_v7_team_stacked_sticker.svg" type="image/svg+xml">
  ${FONT_LINK}
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; background: #0A0C0A; color: #F5F7F5; line-height: 1.55;
      font-family: "Plus Jakarta Sans", system-ui, sans-serif;
    }
    main { max-width: 720px; margin: 0 auto; padding: 1.5rem 1.1rem 4rem 1.1rem; }
    h1 { font-family: "Space Grotesk", system-ui, sans-serif; font-size: 1.7rem; margin: 1rem 0 0.5rem 0; }
    h2 { font-family: "Space Grotesk", system-ui, sans-serif; font-size: 1.1rem; margin: 1.6rem 0 0.4rem 0; color: #52C45A; }
    p, li { font-size: 0.95rem; color: #DDE5DE; }
    a { color: #FFD54F; }
    .nav { font-size: 0.85rem; }
    .draft {
      margin: 1rem 0; padding: 0.7rem 0.9rem; border-radius: 10px; font-weight: 700; font-size: 0.88rem;
      border: 1.5px solid #FFD54F; color: #FFD54F; background: rgba(255, 213, 79, 0.1);
    }
    .meta { color: #9FB0A2; font-size: 0.82rem; }
  </style>
</head>
<body>
  <main>
    <div class="nav"><a href="/">← Holy Basil</a> · <a href="/order">Bestellen</a> · <a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a></div>
    ${draft}
    ${body}
  </main>
</body>
</html>`;
}

export function renderImpressumHtml(): string {
  const c = legalConfig.company;
  return page(
    'Impressum',
    `<h1>Impressum</h1>
    <p>
      <strong>${escHtml(c.name)}</strong> (${escHtml(c.legalForm)})<br>
      ${escHtml(c.street)}<br>
      ${escHtml(c.zipCity)}<br>
      ${escHtml(c.country)}
    </p>
    <h2>Kontakt</h2>
    <p>E-Mail: ${escHtml(c.email)}<br>Telefon: ${escHtml(c.phone)}</p>
    <h2>Handelsregister und UID</h2>
    <p>Unternehmens-Identifikationsnummer: ${escHtml(c.uid)}</p>
    <h2>Vertretungsberechtigte Person</h2>
    <p>${escHtml(c.representative)}</p>
    <h2>Preise und Bestellung</h2>
    <p>
      Alle Preise in Schweizer Franken (CHF) inklusive gesetzlicher Mehrwertsteuer. Eine Bestellung
      über die Bestell-App wird verbindlich, sobald sie bezahlt ist: bar an der Kasse am Truck oder
      über die in der App angebotenen Zahlungsmittel.
    </p>
    <h2>Deklaration</h2>
    <p>
      Fleischherkunft und Allergene werden vor jeder Bestellung in der Bestell-App angezeigt.
      Der Rezepturordner am Truck enthält die vollständigen Angaben.
    </p>
    <p class="meta">Stand: ${escHtml(legalConfig.updatedAt)}</p>`
  );
}

export function renderDatenschutzHtml(): string {
  const c = legalConfig.company;
  const l = legalConfig;
  return page(
    'Datenschutzerklärung',
    `<h1>Datenschutzerklärung</h1>
    <p>
      Diese Erklärung beschreibt, welche Personendaten wir bei der Nutzung dieser Website und der
      Bestell-App bearbeiten. Massgebend ist das Schweizer Datenschutzgesetz (DSG).
    </p>

    <h2>1. Verantwortliche Stelle</h2>
    <p>
      ${escHtml(c.name)}, ${escHtml(c.street)}, ${escHtml(c.zipCity)}, ${escHtml(c.country)}<br>
      Anfragen zum Datenschutz: ${escHtml(l.privacyContact)}
    </p>

    <h2>2. Bestellungen</h2>
    <p>
      Für eine Bestellung brauchen wir weder Namen noch E-Mail-Adresse noch Konto. Wir speichern den
      Inhalt der Bestellung, den Betrag, die Zahlungsart, den Zeitpunkt, den zugewiesenen Abholcode
      («Züri-Code») und die vor der Bestellung angezeigte Deklaration (Fleischherkunft, Allergene).
      Zweck: Zubereitung, Abholung, Buchführung und Nachweis der Deklarationspflicht.
    </p>
    <p>
      Der Abholcode erscheint auf dem öffentlichen Abhol-Bildschirm am Truck. Er lässt keinen
      Rückschluss auf eine Person zu.
    </p>
    <p>Aufbewahrung: ${escHtml(l.retention.orders)}</p>

    <h2>3. Zahlung</h2>
    <p>
      Barzahlungen erfolgen an der Kasse am Truck. Für Online-Zahlungen (TWINT, Karte) leiten wir Sie
      an den Zahlungsanbieter weiter: ${escHtml(l.paymentProvider)}. Wir erhalten von dort nur die
      Bestätigung, ob die Zahlung erfolgt ist, sowie eine Zahlungsreferenz. Karten- oder
      Kontodaten sehen und speichern wir nicht.
    </p>

    <h2>4. Speicherung auf Ihrem Gerät</h2>
    <p>
      Die Bestell-App legt die Kennung Ihrer laufenden Bestellung im lokalen Speicher Ihres Browsers
      ab, damit Ihr Abhol-Ticket nach einem Neuladen wieder erscheint. Das ist technisch nötig und
      wird nach Abschluss der Bestellung gelöscht. Wir setzen keine Tracking- oder Werbe-Cookies und
      keine Analyse-Dienste ein. Schriften werden von unserem eigenen Server geladen.
    </p>

    <h2>5. Tour-Alert (Newsletter)</h2>
    <p>
      Für den Tour-Alert speichern wir Ihre E-Mail-Adresse und Ihr gewähltes Quartier. Die Anmeldung
      gilt erst, wenn Sie den Link in der Bestätigungs-E-Mail anklicken (Double-Opt-in). Als Nachweis
      Ihrer Einwilligung speichern wir den Einwilligungstext, den Zeitpunkt der Anmeldung und den
      Zeitpunkt der Bestätigung. Nicht bestätigte Anmeldungen löschen wir nach 48 Stunden.
    </p>
    <p>Einwilligungstext: «${escHtml(NEWSLETTER_CONSENT.text)}»</p>
    <p>
      Sie können sich jederzeit über den Abmeldelink in jeder E-Mail abmelden. Dabei löschen wir Ihre
      Adresse. Versand über: ${escHtml(l.mailProvider)}.
    </p>

    <h2>6. Catering-Anfragen</h2>
    <p>
      Im Anfrageformular erheben wir Firmenname, Kontaktperson, E-Mail-Adresse und Angaben zum
      Anlass, um Ihre Anfrage zu beantworten. Aufbewahrung: ${escHtml(l.retention.b2b)}
    </p>

    <h2>7. Server-Protokolle und Hosting</h2>
    <p>
      Beim Aufruf der Website verarbeitet der Server technisch notwendige Daten wie IP-Adresse,
      Zeitpunkt und aufgerufene Seite, auch zum Schutz vor Missbrauch (Begrenzung von Anfragen).
      Hosting: ${escHtml(l.hostingProvider)}. Aufbewahrung der Protokolle:
      ${escHtml(l.retention.serverLogs)}
    </p>

    <h2>8. Weitergabe und Auslandbezug</h2>
    <p>
      Wir geben Personendaten nur an die oben genannten Dienstleister weiter, soweit das für den
      jeweiligen Zweck nötig ist. Wo ein Dienstleister Daten ausserhalb der Schweiz bearbeitet, ist
      das beim jeweiligen Dienstleister angegeben.
    </p>

    <h2>9. Ihre Rechte</h2>
    <p>
      Sie haben das Recht auf Auskunft über Ihre Personendaten, auf Berichtigung, Löschung und
      Herausgabe sowie auf Widerruf einer Einwilligung. Wenden Sie sich dafür an
      ${escHtml(l.privacyContact)}. Sie können sich ausserdem an den Eidgenössischen Datenschutz-
      und Öffentlichkeitsbeauftragten (EDÖB) wenden.
    </p>

    <p class="meta">Stand: ${escHtml(l.updatedAt)}</p>`
  );
}
