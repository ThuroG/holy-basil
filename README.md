# Holy Basil Zürich · Pad Krapao Foodtruck & Web-Plattform

[![Vitest Coverage](https://img.shields.io/badge/coverage-93.6%25-brightgreen.svg)](#-qualität--tests)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-green.svg)](https://nodejs.org/)

> **Ein Gericht. Volle Wok-Hitze. Zürichs authentischstes Pad Krapao.**  
> 100% vegane Saucenbasis (keine Austern- oder Fischsauce), kompromisslos feurig im Wok serviert mit duftendem Jasminreis und knusprigem Thai-Spiegelei (*Kai Dao*). Für faire CHF 12.– bis 15.–.

---

## 🌟 Übersicht der Web-Plattform

Die Plattform kombiniert einen cineastischen, scroll-gesteuerten Webauftritt mit einem hochperformanten, mobilen QR-Bestellsystem und einem 4-Stationen-Küchendisplay (KDS) für maximale Geschwindigkeit am Foodtruck.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HOLY BASIL PLATTFORM                            │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ 🌐 Webauftritt     │ 📱 Mobile App      │ 🍳 Foodtruck Cockpit & KDS   │
│ Route: /           │ Route: /order      │ /admin (PIN) & /board        │
│                    │                    │                              │
│ • Scroll-Craft     │ • 1–10 Portionen   │ • 4-Stationen-Workflow       │
│ • 5-Act Hero       │ • Express/Custom   │ • Zero-Click Wok-Demand      │
│ • Split-Flap Tour  │ • Bar am Truck     │ • Kassen-Freigabe (Cash)     │
│ • "Track Truck"    │ • Züri-Code Ticket │ • Public Pickup Board        │
└────────────────────┴────────────────────┴──────────────────────────────┘
```

---

## 🚀 Kernkomponenten

### 1. Scroll-Craft Webauftritt (`/`)
Entwickelt nach dem dimensionalen **Scroll-Craft**-Standard:
- **Act 1 – Dimensional Hero Stage:** 5 unabhängige visuelle Ebenen (Asphalt-Raster, Goldene Aura, Backplane-Typografie, freigestelltes v7 Logo-Emblem und Vordergrund-Badges) mit separater Mobile-Komposition (< 760px).
- **Act 2 – The One-Dish Manifesto:** Warum Pad Krapao? Warum 100% vegane Basis? Transparenz und Streetfood-Kultur.
- **Act 3 – The Peak (Horizontal Wok Pan):** Kameraschwenk über das Lineup: **Holy Vegan** (CHF 12), **Holy Chicken** (CHF 15), **Holy Pork / Mix** (CHF 15) & **Kai Dao** (+CHF 2.50).
- **Act 4 – Bespoke Signature Move (Split-Flap Tour Tracker):** Mechanisches Blättern durch die Zürcher Quartiere (`8005 Züri West`, `8004 Langstrasse`, `8050 Oerlikon`, `8400 Winti`, `8001 Niederdorf`) mit direkter Newsletter-Anbindung (*"Track the Truck"*).
- **Act 5 – Commitment & B2B:** Direkte Weiterleitung zur QR-Bestellung und B2B-Catering-Formular.

### 2. Mobile QR-Bestell-App (`/order`)
Optimiert für Smartphone-Browser bei direkter QR-Code-Nutzung vor Ort oder vorab online:
- **1 bis 10 Portionen pro Bestellung:** Schneller *Express-Modus* ("alle Boxen identisch") oder detailgenaue *Box-für-Box-Konfiguration*.
- **Feature-Toggle für Schärfegrade (`enableCustomSpiceLevels`):**
  - Standardmässig auf `false`: Alle Boxen erhalten die perfekt ausbalancierte *Standardschärfe (leicht scharf 🌶️)* für maximale Wok-Kadenz.
  - Dynamisch zuschaltbar für 4 Stufen (*Mild*, *Leicht scharf*, *Thai Spicy*, *Extra Hot*).
- **Zahlungsarten:** **Barzahlung am Truck (`pending_cash`)**. TWINT und Karte sind noch nicht angebunden und erscheinen nur im Demo-Modus als Simulation (siehe [Betrieb & Sicherheit](#-betrieb--sicherheit)).
- **Ticket bleibt erhalten:** Nach der Bestellung liegt das Ticket unter `/order/<id>` und überlebt Reload und gesperrtes Handy.
- **Züri-Code Boarding-Pass:** Jede Bestellung erhält eine eindeutige Zürcher Postleitzahl mit Quartiersnamen (z. B. `8004 · LANGSTRASSE`).

### 3. Foodtruck Operations & Admin KDS (`/admin`, nur mit Crew-PIN)
Das Küchenleitsystem strukturiert den Ablauf am Truck in 4 klare Arbeitsstationen:
1. **Station 1 – Kasse:** Überwacht Barzahlungen (`pending_cash`) und Zahlungs-Timeouts (`payment_error_fallback`) mit 1-Tap-Freigabe in den Wok.
2. **Station 2 – Zero-Click Wok-Cockpit:** Der Koch muss nichts tippen. Ein intelligenter Aggregator summiert alle bezahlten, ungeschöpften Portionen nach Protein und Eiern inklusive konkreter Batch-Empfehlung in Echtzeit.
3. **Station 3 – Schöpfer-Station:** Boxen anrichten, Reis portionieren, Krapao & Spiegelei schöpfen, 1-Tap Übergabe an QC.
4. **Station 4 – Qualitätskontrolle (QC) & Drinks:** Kontrolle, Hinzufügen von gekühltem *Thai Iced Tea* / *Kokoswasser*, Aufruf auf den Monitor (`ready`) und Übergabe an den Gast (`completed`).

### 4. Public Pickup Board (`/board`)
Grossbildschirm-Anzeige für wartende Gäste vor dem Foodtruck mit SBB-Split-Flap-Ästhetik:
- Spalte 1: *Im Wok & Schöpfen* (gelb pulsierend)
- Spalte 2: *Abholbereit am Truck* (grün leuchtend)

---

## 🔐 Betrieb & Sicherheit

| Thema | Stand |
| :--- | :--- |
| **Crew-Zugang** | `/admin` und alle schreibenden Crew-Routen verlangen eine Anmeldung mit PIN (`CREW_PIN`). Ohne gesetzte PIN erzeugt der Server bei jedem Start eine zufällige und zeigt sie in der Konsole. |
| **Gäste** | Sehen nur die eigene Bestellung (über die nicht erratbare Bestell-ID) und auf dem Board nur Code und Status. |
| **Zahlung** | Standard: nur Bar an der Kasse. Erst die Kasse gibt eine Bestellung für den Wok frei. `DEMO_PAYMENTS=1` blendet TWINT/Karte als **Simulation** ein. Es ist kein Zahlungsanbieter angebunden. |
| **Daten** | Bestellungen, Newsletter, B2B-Anfragen und Einstellungen liegen als JSON in `data/` und werden beim Start geladen. Aktive Bestellungen behalten nach einem Neustart ihren Züri-Code. |
| **Statusfolge** | Fest vorgegeben: Kasse → Wok → Schöpfen → Aufruf → Übergabe. Rücksprünge und unbekannte Status werden abgelehnt. |
| **Züri-Codes** | Zufällige Vergabe, 5 Minuten Sperre nach Übergabe. Unbezahlte Bestellungen verfallen nach 20 Minuten. |

### Umgebungsvariablen

| Variable | Wirkung |
| :--- | :--- |
| `CREW_PIN` | PIN für `/admin` (mind. 4 Zeichen). Im Betrieb immer setzen. |
| `DEMO_PAYMENTS` | `1` = TWINT/Karte als Simulation sichtbar, Demo-Bestellungen beim ersten Start. |
| `PUBLIC_BASE_URL` | Öffentliche Adresse für den QR-Code, z. B. `https://holybasil.ch`. |
| `PORT` | Port, Standard `3000`. |
| `HB_DATA_DIR` | Datenordner, Standard `./data`. |

### Vor dem ersten echten Einsatz offen

- Zahlungsanbieter für TWINT/Karte anbinden (inkl. Webhook-Bestätigung).
- Impressum, Datenschutzerklärung und Double-Opt-in für den Newsletter.
- HTTPS über einen Reverse Proxy, Schriften selbst hosten statt von Google laden.
- Die Tourdaten in `src/lib/orderStore.ts` sind Beispieldaten.

---

## ✅ Qualität & Tests

40 automatisierte Tests (Vitest) decken Bestellablauf, Zugriffsschutz, Statusfolge, Eingabeprüfung, Neustart-Verhalten und den HTTP-Server ab.

| Kennzahl | Wert |
| :--- | :--- |
| Statements / Lines | 93.6 % |
| Branches | 89.2 % |
| Functions | 97.8 % |

Gemessen über den gesamten Server-Code in `src/`. Die Views sind HTML-Vorlagen: Ihr Browser-Skript läuft in diesen Tests nicht und ist damit nicht abgedeckt.

```bash
npm test                # Tests
npm run test:coverage   # Tests mit Coverage-Report
npm run typecheck       # TypeScript prüfen
```

---

## 🛠️ Schnellstart & Lokale Entwicklung

### Voraussetzungen
- Node.js ≥ 20.x
- npm ≥ 10.x

### Installation & Start
```bash
# Abhängigkeiten installieren
npm install

# Server starten (Port 3000, nur Barzahlung)
npm run dev

# Oder zum Ausprobieren: Demo-Modus mit simulierter TWINT-/Kartenzahlung und Beispiel-Bestellungen
npm run dev:demo
```

Die Crew-PIN für `/admin` steht beim Start in der Konsole, solange `CREW_PIN` nicht gesetzt ist.

Der Server ist anschliessend erreichbar unter:
- Landing Page: `http://localhost:3000/`
- Mobile Bestellung: `http://localhost:3000/order`
- Foodtruck Operations & Admin (PIN): `http://localhost:3000/admin`
- Public Pickup Monitor: `http://localhost:3000/board`
- Health Endpoint: `http://localhost:3000/api/health` (Kennzahlen nur für die Crew)

---

## 📁 Projektstruktur

```
├── assets/                    # Marken-Assets, Logo-Iterationen (v1–v7) & Team Sticker/Embleme
├── data/                      # Lokaler Speicher: Bestellungen, Newsletter, B2B, Einstellungen (nicht im Git)
├── scrollcraft/               # Scroll-Craft Landingpage Engine & Assets
│   └── builds/holy-basil/     # HTML, CSS, JS & Briefing der 5-Act Experience
├── src/
│   ├── config/
│   │   └── features.ts        # Feature Toggles, Menü- und Preiskonfiguration
│   ├── lib/
│   │   ├── apiHandler.ts      # REST API Router & JSON Endpoints, Crew-/Gast-Rechte
│   │   ├── auth.ts            # Crew-PIN, Sessions, Login-Bremse
│   │   ├── orderStore.ts      # Auftrags-Lebenszyklus, Züri-Code Zuordnung & Datenhaltung
│   │   ├── paymentService.ts  # Zahlungs-SIMULATION (Demo), Idempotenz & 800ms Fallback Guard
│   │   ├── response.ts        # Einheitliche API-Responses & Latenz-Tracking
│   │   ├── types.ts           # Vollständige TypeScript Domain-Typen
│   │   ├── wokDemand.ts       # Zero-Click Aggregator für den Koch
│   │   └── zueriCodes.ts      # Pool & Kollisionsschutz für 55+ Zürcher Postleitzahlen
│   ├── views/                 # Serverseitig gerenderte HTML-Views (order, admin, board)
│   └── server.ts              # HTTP Server & Statische Asset-Auslieferung
├── tests/                     # Vitest Unit- und Integrations-Testsuite
├── README_APP_AND_TECH.md     # Ausführliche technische Architektur & PRD
├── README_DESIGN.md           # Brand Identity, Visual Language & Design System
└── README_STRATEGY.md         # Business-Modell, One-Dish-Strategie & Standort-Konzept
```

---

## 📄 Weiterführende Dokumentation
- [README_APP_AND_TECH.md](README_APP_AND_TECH.md): Vollständige Spezifikation des Züri-Code-Systems, API-Contracts und Küchen-Workflows.
- [README_DESIGN.md](README_DESIGN.md): Markenidentität, Farben, Schriften, Badges und Sticker-Konzepte.
- [README_STRATEGY.md](README_STRATEGY.md): Foodtruck-Konzept, Wirtschaftlichkeit, Preiskalkulation und Zielgruppen.
