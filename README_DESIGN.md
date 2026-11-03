# Holy Basil – Design, Brand Identity & Agent Guidelines

> **Zweck dieses Dokuments:** Dieses Dokument dient als verbindlicher Styleguide und Prompt-Kontext für KI-Agenten (Web-Development, UI/UX, Grafik-Generierung) sowie Designer, um einen konsistenten, unverwechselbaren Markenauftritt für **Holy Basil** zu gewährleisten.

---

## 1. Brand Essence & Vibe

**Holy Basil** bringt das authentischste Streetfood Thailands – **Pad Krapao (Stir-Fried Holy Basil)** – mit voller Wucht in die Zürcher Streetfood-Szene. 

Der visuelle Auftritt bricht bewusst mit klassischen „Thai-Restaurant-Klischees" (kein Gold-Kitsch, keine verschnörkelten Tempel-Motive). Stattdessen verschmelzen wir drei Welten:
1. **90s / Golden Era & Modern Hip-Hop:** Roh, urban, selbstbewusst, Street-Credibility, Boom-Bap trifft modernen Zürcher Zeitgeist.
2. **Street Art & Graffiti-Kultur:** Kräftige Outlines (Outlines/Tags), gesprühte Texturen, Sticker-Ästhetik, plakative Kontraste.
3. **Thai Streetfood Heritage:** Dezente, respektvolle Anspielungen auf Bangkoks Nachtmärkte, Thai-Typografie-Rhythmen und die botanische Schärfe des heiligen Basilikums (*Ocimum tenuiflorum*).

### Marken-Attribute
- **Urban & Bold:** Fällt auf jedem Streetfood-Festival, Weihnachtsmarkt und im Social-Media-Feed sofort auf.
- **Unkompliziert & Ehrlich:** Ein Gericht, drei Varianten, fairer Preis – das Design kommuniziert Direktheit ohne Schnickschnack.
- **Kult-Potenzial:** Gebaut für Merch, Sticker an Zürcher Laternenpfählen, Foodtruck-Folierung und eine prägnante Bestell-App.

---

## 2. Logo-Konzept (Das „Holy Leaf"-Icon)

Das zentrale Markenzeichen ist eine Kombination aus Bildmarke (Icon) und Wortmarke (**HOLY BASIL**).

### Bildmarke (Icon)
- **Motiv:** Ein **einzelnes, frei schwebendes Basilikumblatt im Halbprofil (leicht seitliche 3/4-Ansicht)** im Comic-/Pop-Art-Illustrationsstil – mit geschwungener Hauptader, organisch gewölbten Blatt-Kissen zwischen den Seitenadern und 3–4 markanten seitlichen Einkerbungen.
- **Ausrichtung:** Dynamisch schwebend im Halbprofil, mit der **geschwungenen Blattspitze nach oben zeigend**.
- **Der Twist (Der Heiligenschein):** Direkt oberhalb der Blattspitze schwebt ein **Heiligenschein (Halo) in leuchtendem Street Gold (`#FFD54F`)** – leicht angeschrägt, im Graffiti-Stil mit weissem Glanz-Bogen und **Spray-Drips** gezeichnet.
- **Stilistik:** 
  - Klare, dicke **Comic-/Graffiti-Konturen (Bold Black Ink + Neon-Herb Sticker-Rim)**, damit das einzelne Blatt auf schwarzem Hintergrund („Pitch Black `#0A0A0A`") räumlich hervorspringt.
  - Organisches **Cel-Shading** entlang der Blattadern: Tiefes Blattgrün (`#1B4D2E`) in den Schattenmulden entlang der Mittel- und Seitenadern, sattes Kern-Grün (`#2E7D32`) im Blattkörper und leuchtendes **Neon Herb (`#52C45A`)** auf den gewölbten Blatt-Kissen.

### Wortmarke
- **Schriftzug:** `HOLY BASIL` (optional mit Graffiti-Anführungszeichen `„BASIL"` und Doppel-Underline-Balken).
- **Stil (Mix aus 3D-Hip-Hop-Block & Chisel-Marker-Tag):**
  - *Option A (100% Pure White Hip-Hop):* Beide Wörter in angeschrägter, kantiger Hip-Hop-Vektorschrift in **Chalk White (`#F5F7F5`)** mit tiefem schwarzen/dunkelgrünen 3D-Block-Schatten und Doppel-Underline-Slash.
  - *Option B (Mix Weiss & Neon-Herb):* `HOLY` im kantigen 3D-Hip-Hop-Block-Stil in Weiss + `„BASIL"` im breiten **Chisel-Marker-Tag-Stil** (mit verlängertem `B`-Dach, geschwungenem Graffiti-`S`, Kick-out-`L` und `„ "` Quotes) in Neon Herb (`#52C45A`).

---

## 3. Farbpalette (Color System)

Das Farbkonzept basiert auf einem kompromisslosen **Schwarz-Grün-Kontrast**. Schwarz bildet die Bühne (Foodtruck, App-Darkmode, Verpackung), während das zweistufige Blattgrün Frische, Kräuter-Intensität und Energie transportiert.

| Rolle | Farbname | Hex-Code | Verwendung |
| :--- | :--- | :--- | :--- |
| **Background Primary** | Pitch Black / Asphalt | `#0A0A0A` | Haupt-Hintergrund (Foodtruck, Website/App, Menuboard) |
| **Background Secondary** | Charcoal Street | `#161816` | Cards, Container, UI-Flächen mit minimalem Grün-Unterton |
| **Brand Green Dark** | Deep Krapao Green | `#1B4D2E` | Dunkles Blattgrün (Blatt-Schattenseite, Flächen, Badges) |
| **Brand Green Core** | Holy Leaf Green | `#2E7D32` | Haupt-Blattgrün für primäre Brand-Elemente |
| **Brand Green Bright** | Neon Herb / Highlight | `#4CAF50` bis `#66BB6A` | Helles Blattgrün für Blattadern, Kontur-Highlights, CTAs, Hover-States |
| **Halo / Accent** | Sacred Glow (Gold/Warm White) | `#FFD54F` oder `#F5F5F0` | Optional für den Heiligenschein (oder ebenfalls in leuchtendem Hellgrün/Weiss) |
| **Text Primary** | Chalk White | `#F5F7F5` | Fliesstext, Preise, Headlines auf schwarzem Grund |
| **Text Muted** | Concrete Grey | `#9EA79E` | Sekundäre Infos, Beschreibungen, Inaktive UI-Elemente |
| **Chili Alert (Optional)** | Bird's Eye Red | `#E53935` | Nur punktuell für Schärfegrad-Icons (Chili-Skala) |

### CSS Custom Properties (für Web- & App-Agenten)
```css
:root {
  --bg-primary: #0A0A0A;
  --bg-elevated: #161816;
  --bg-surface: #1F2420;

  --green-deep: #1B4D2E;
  --green-core: #2E7D32;
  --green-highlight: #52C45A;

  --halo-accent: #FFD54F;
  --chili-accent: #E53935;

  --text-primary: #F5F7F5;
  --text-secondary: #9EA79E;
  --border-bold: 2.5px solid #52C45A;
}
```

---

## 4. Typografie-System

Die Typografie verbindet **Hip-Hop-Plakativität** mit **Schweizer Lesbarkeit** (besonders wichtig für schnelle Bestellungen am Truck und in der App).

1. **Display / Headlines (Graffiti & Hip-Hop Vibe):**
   - *Charakter:* Hand-styled Street-Font, Marker-/Brush- oder Urban-Block-Display.
   - *Einsatz:* Logo, Hero-Titel („ONE DISH. NO BULLSHIT."), Kategorie-Titel, PLZ-Abholcodes auf dem Screen.
   - *Web-Font-Referenzen / Richtung:* `Permanent Marker`, `Rubik Spray Paint`, `Sedgwick Ave Display` oder kräftige Kondens-Schriften wie `Anton` / `Bebas Neue` kombiniert mit überlagerten Graffiti-Tags.
2. **UI & Body Font (Modern Clean Grotesque):**
   - *Charakter:* Klare, geometrische oder neo-groteske Sans-Serif (Hommage an Schweizer Typografie).
   - *Einsatz:* Zutatenlisten, Allergene, Bestell-App-Buttons, B2B-Offerten.
   - *Web-Font-Referenzen:* `Space Grotesk`, `Plus Jakarta Sans` oder `Inter`.
3. **Monospace / Code Font (Für das Zürcher PLZ-/Quartier-Abholsystem):**
   - *Charakter:* Technisch-urban wie eine Abflugtafel / Split-Flap-Display.
   - *Einsatz:* Bestellcodes (z. B. `8004 - LANGSTRASSE`, `8005 - HARD`), Preise (`CHF 12.–`).
   - *Web-Font-Referenzen:* `JetBrains Mono` oder `Space Mono`.

---

## 5. Physischer & Digitaler Auftritt (Touchpoints)

### Foodtruck & Pop-up-Stand
- **Aussenfarbe:** Mattschwarz (`#0A0A0A`) als Grundfolierung.
- **Eyecatcher:** Grossflächiges Holy-Basil-Logo (Blatt + Heiligenschein) mit leuchtend grünen Outlines und dezenten schwarzen Gloss-Graffiti-Tags (Schwarz-auf-Schwarz-UV-Lack-Optik) im Hintergrund.
- **Menüboard:** Extrem reduziert. Nur die **3 Varianten** (Vegan CHF 12 / Chicken / Pork-Beef Mix bis CHF 15), das **100%-Vegan-Base-Siegel** und der **Abhol-Screen** für die Zürcher PLZ-/Stadtl-Codes.

### Packaging & Merch
- Schwarze oder ungebleichte Kraftpapier-Boxen mit einem grossen, grünen Graffiti-Stempel oder Sticker (Logo + „100% Vegan Sauce Base").
- Sticker-Packs für Kunden (z. B. „8004 Crew x Holy Basil", Basilikumblatt mit Halo).

---

## 6. Prompt-Vorlagen für KI-Bildgeneratoren (Image Agents)

Falls ein Agent das Logo oder Moodboards generieren soll, kann folgender Basis-Prompt verwendet werden:

> **Logo Prompt:**  
> *"Vector street art graffiti logo on a pure matte black background (#0A0A0A). Centerpiece is a single Thai holy basil leaf (Krapao leaf) pointing straight upwards with jagged edges. Floating directly above the tip of the leaf is a glowing street-art halo (saint ring). Two-tone leaf green palette: deep forest green (#1B4D2E) and vibrant bright leaf green (#52C45A) with bold cartoon/graffiti outlines, subtle spray paint texture, hip-hop streetwear aesthetic, subtle Thai typography flair, clean high-contrast vector illustration."*
