import { DESIGN_TOKENS_CSS, FONT_LINK, LEGAL_LINKS_HTML, LOGO_STICKER_TRANSPARENT } from './shared.js';

export function renderBoardPageHtml(): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HOLY BASIL · Public Pickup Board (Züri-Codes)</title>
  <link rel="icon" href="${LOGO_STICKER_TRANSPARENT}" type="image/svg+xml">
  ${FONT_LINK}
  <style>
    ${DESIGN_TOKENS_CSS}
    :root {
      --bg: var(--bg-primary);
      --surface: var(--bg-surface);
      --green-neon: var(--green-sunlight);
      --gold: #FFD54F;
      --ink: var(--text-primary);
      --muted: var(--text-secondary);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--font-display);
      display: flex;
      flex-direction: column;
    }
    .topbar {
      padding: 0.75rem 2rem;
      background: #0D120E;
      border-bottom: 2px solid var(--green-neon);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--ink);
      text-decoration: none;
    }
    .brand img { width: 42px; height: 42px; }
    .top-info { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; font-family: var(--font-mono); font-size: 0.95rem; }
    .chip { padding: 0.45rem 0.8rem; border-radius: 10px; border: 1.5px solid var(--gold); color: var(--gold); text-decoration: none; background: transparent; font-family: inherit; font-size: inherit; cursor: pointer; }
    .chip--paused { border-color: #E53935; color: #FFCDD2; }
    .board-grid {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr 1.3fr;
      gap: 1.5rem;
      padding: 1.5rem 2rem;
    }
    .board-col {
      background: var(--surface);
      border: 2px solid rgba(82, 196, 90, 0.3);
      border-radius: 24px;
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .board-col--ready { background: #102114; border: 3px solid var(--green-neon); }
    .col-title {
      font-size: 1.5rem;
      margin: 0 0 1rem 0;
      padding-bottom: 0.6rem;
      border-bottom: 2px solid rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    /* The lists never scroll: the script shows as many codes as fit, plus a "+N weitere" line. */
    .code-grid { flex: 1; min-height: 0; overflow: hidden; display: grid; gap: 0.75rem; align-content: start; }
    #inWokList { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
    #readyList { grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); }
    .flap-card {
      background: #0A0E0B;
      border: 2px solid rgba(255, 213, 79, 0.45);
      border-radius: 14px;
      padding: 0 1rem;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.6rem;
      overflow: hidden;
    }
    .flap-card--ready {
      background: #16361D;
      border: 3px solid var(--green-neon);
      height: 104px;
      padding: 0 1.4rem;
      box-shadow: 0 12px 32px rgba(82, 196, 90, 0.28);
    }
    .flap-card--new { animation: callOut 1.1s ease-in-out 6; }
    @keyframes callOut {
      0%, 100% { background: #16361D; transform: scale(1); }
      50% { background: #2E7D32; transform: scale(1.03); }
    }
    @media (prefers-reduced-motion: reduce) { .flap-card--new { animation: none; border-color: var(--gold); } }
    .plz-big { font-family: var(--font-mono); font-size: 1.9rem; font-weight: 800; color: var(--gold); }
    .flap-card--ready .plz-big { font-size: 3.1rem; color: var(--green-neon); }
    .quarter-big { font-size: 1rem; font-weight: 800; color: var(--ink); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .flap-card--ready .quarter-big { font-size: 1.45rem; }
    .more-line { font-family: var(--font-mono); font-size: 1.1rem; color: var(--muted); padding-top: 0.6rem; }
    .empty { color: var(--muted); font-size: 1.1rem; }
    .foot { padding: 0.4rem 2rem; font-size: 0.75rem; color: var(--muted); text-align: right; }
    .foot a { color: var(--muted); }
    @media (max-width: 900px) {
      html, body { height: auto; }
      .board-grid { grid-template-columns: 1fr; padding: 1rem; }
      .code-grid { overflow: visible; }
    }
  </style>
</head>
<body>

  <header class="topbar">
    <a class="brand" href="/">
      <img src="${LOGO_STICKER_TRANSPARENT}" alt="Holy Basil">
      <span>HOLY BASIL · ZÜRI-CODE PICKUP</span>
    </a>
    <div class="top-info">
      <span id="waitInfo" role="status"></span>
      <button type="button" class="chip" id="soundBtn" aria-pressed="false">🔇 Ton einschalten</button>
      <a href="/order" class="chip">Jetzt bestellen</a>
    </div>
  </header>

  <main class="board-grid">
    <section class="board-col">
      <h2 class="col-title">
        <span>🔥 IN ZUBEREITUNG</span>
        <span style="font-family: var(--font-mono); color: var(--gold);" id="inWokCount">0</span>
      </h2>
      <div class="code-grid" id="inWokList"></div>
      <div class="more-line" id="inWokMore"></div>
    </section>

    <section class="board-col board-col--ready">
      <h2 class="col-title" style="color: var(--green-neon);">
        <span>🔔 ABHOLBEREIT AM TRUCK</span>
        <span style="font-family: var(--font-mono);" id="readyCount">0</span>
      </h2>
      <div class="code-grid" id="readyList" aria-live="polite"></div>
      <div class="more-line" id="readyMore"></div>
    </section>
  </main>
  <div class="foot">${LEGAL_LINKS_HTML}</div>

  <script>
    function esc(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
      ));
    }

    const PREP_CARD = { height: 72, minWidth: 230 };
    const READY_CARD = { height: 104, minWidth: 330 };
    const GAP = 12;
    const NEW_MS = 20000;       // a freshly called code flashes for this long

    let entries = [];
    let knownReady = null;      // codes that were already on the board (null = first load)
    const calledAt = {};        // code -> local time it first showed up as ready
    let lastSig = "";
    let soundOn = false;
    let audioCtx = null;

    // How many cards fit into a list without scrolling.
    function capacity(el, card) {
      const narrow = window.matchMedia("(max-width: 900px)").matches;
      if (narrow) return 200;
      const cols = Math.max(1, Math.floor((el.clientWidth + GAP) / (card.minWidth + GAP)));
      const rows = Math.max(1, Math.floor((el.clientHeight + GAP) / (card.height + GAP)));
      return cols * rows;
    }

    function card(entry, ready, isNew) {
      return '<div class="flap-card' + (ready ? ' flap-card--ready' : '') + (isNew ? ' flap-card--new' : '') + '">' +
        '<span class="plz-big">' + esc(entry.plz) + '</span>' +
        '<span class="quarter-big">' + esc(entry.quarter) + '</span>' +
      '</div>';
    }

    function beep() {
      if (!soundOn || !audioCtx) return;
      try {
        [0, 0.22].forEach((offset, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "triangle";
          osc.frequency.value = i === 0 ? 660 : 880;
          gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + offset);
          gain.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + offset + 0.2);
          osc.connect(gain).connect(audioCtx.destination);
          osc.start(audioCtx.currentTime + offset);
          osc.stop(audioCtx.currentTime + offset + 0.22);
        });
      } catch {}
    }

    // Browsers only allow sound after a tap, so the crew switches it on once per screen.
    document.getElementById("soundBtn").addEventListener("click", () => {
      soundOn = !soundOn;
      if (soundOn && !audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtx = new Ctx();
      }
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
      const btn = document.getElementById("soundBtn");
      btn.textContent = soundOn ? "🔊 Ton an" : "🔇 Ton einschalten";
      btn.setAttribute("aria-pressed", String(soundOn));
      if (soundOn) beep();
    });

    function render() {
      const now = Date.now();
      const inPrep = entries.filter((e) => e.phase === "preparing");
      // Newest call first: the code that was just called is always at the top left.
      const ready = entries.filter((e) => e.phase === "ready").slice().reverse();

      const prepEl = document.getElementById("inWokList");
      const readyEl = document.getElementById("readyList");
      const prepFit = capacity(prepEl, PREP_CARD);
      const readyFit = capacity(readyEl, READY_CARD);
      const prepShown = inPrep.slice(0, prepFit);
      const readyShown = ready.slice(0, readyFit);

      const sig = JSON.stringify([
        prepShown.map((e) => e.plz), inPrep.length,
        readyShown.map((e) => e.plz + (now - (calledAt[e.plz] || 0) < NEW_MS ? "*" : "")), ready.length
      ]);
      if (sig === lastSig) return;
      lastSig = sig;

      document.getElementById("inWokCount").textContent = String(inPrep.length);
      document.getElementById("readyCount").textContent = String(ready.length);

      prepEl.innerHTML = inPrep.length === 0
        ? '<div class="empty">Der Wok ist bereit für deine Bestellung.</div>'
        : prepShown.map((e) => card(e, false, false)).join("");
      document.getElementById("inWokMore").textContent =
        inPrep.length > prepShown.length ? "+ " + (inPrep.length - prepShown.length) + " weitere in Zubereitung" : "";

      readyEl.innerHTML = ready.length === 0
        ? '<div class="empty">Sobald dein Code hier grün aufleuchtet, kannst du deine Box abholen.</div>'
        : readyShown.map((e) => card(e, true, now - (calledAt[e.plz] || 0) < NEW_MS)).join("");
      document.getElementById("readyMore").textContent =
        ready.length > readyShown.length ? "+ " + (ready.length - readyShown.length) + " weitere abholbereit: bitte an der Ausgabe melden" : "";
    }

    async function pollBoard() {
      try {
        const res = await fetch("/api/board");
        const json = await res.json();
        if (!json.success) return;
        entries = json.data.entries || [];

        const readyNow = entries.filter((e) => e.phase === "ready").map((e) => e.plz);
        if (knownReady !== null) {
          const fresh = readyNow.filter((plz) => !knownReady.includes(plz));
          fresh.forEach((plz) => { calledAt[plz] = Date.now(); });
          if (fresh.length > 0) beep();
        }
        knownReady = readyNow;
        Object.keys(calledAt).forEach((plz) => { if (!readyNow.includes(plz)) delete calledAt[plz]; });

        const queue = json.data.queue;
        const info = document.getElementById("waitInfo");
        if (queue && queue.ordersPaused) {
          info.textContent = "Bestellannahme pausiert";
          info.className = "chip chip--paused";
        } else if (queue) {
          info.textContent = "Wartezeit ca. " + queue.estimatedWaitMinutes + " Min.";
          info.className = "";
        }
        render();
      } catch {}
    }

    window.addEventListener("resize", () => { lastSig = ""; render(); });
    pollBoard();
    setInterval(pollBoard, 2000);
    setInterval(render, 5000); // lets the flash of a new call end on time
  </script>
</body>
</html>`;
}
