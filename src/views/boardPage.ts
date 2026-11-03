export function renderBoardPageHtml(): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HOLY BASIL · Public Pickup Board (Züri-Codes)</title>
  <link rel="icon" href="/assets/holy_basil_logo_v7_team_stacked_sticker.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700;800&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #080A08;
      --surface: #121813;
      --green-neon: #52C45A;
      --gold: #FFD54F;
      --ink: #F5F7F5;
      --muted: #8FA092;
      --font-display: "Space Grotesk", system-ui, sans-serif;
      --font-mono: "JetBrains Mono", monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--font-display);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .topbar {
      padding: 1rem 2rem;
      background: #0D120E;
      border-bottom: 2px solid var(--green-neon);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--ink);
      text-decoration: none;
    }
    .brand img { width: 46px; height: 46px; }
    .board-grid {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 2rem;
      padding: 2rem;
    }
    .board-col {
      background: var(--surface);
      border: 2px solid rgba(82, 196, 90, 0.3);
      border-radius: 24px;
      padding: 1.75rem;
    }
    .board-col--ready {
      background: #102114;
      border: 3px solid var(--green-neon);
    }
    .col-title {
      font-size: 1.6rem;
      margin: 0 0 1.25rem 0;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .code-grid {
      display: grid;
      gap: 1rem;
    }
    .flap-card {
      background: #0A0E0B;
      border: 2px solid rgba(255, 213, 79, 0.45);
      border-radius: 16px;
      padding: 1.15rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .flap-card--ready {
      background: #16361D;
      border: 3px solid var(--green-neon);
      padding: 1.4rem 1.75rem;
      box-shadow: 0 12px 32px rgba(82, 196, 90, 0.28);
    }
    .plz-big {
      font-family: var(--font-mono);
      font-size: 2.6rem;
      font-weight: 800;
      color: var(--gold);
    }
    .flap-card--ready .plz-big {
      font-size: 3.4rem;
      color: var(--green-neon);
    }
    .quarter-big {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--ink);
    }
    @media (max-width: 900px) {
      .board-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <header class="topbar">
    <a class="brand" href="/">
      <img src="/assets/holy_basil_logo_v7_team_stacked_sticker.svg" alt="Holy Basil">
      <span>HOLY BASIL · ZÜRI-CODE PICKUP MONITOR</span>
    </a>
    <div style="display: flex; gap: 0.75rem;">
      <a href="/order" style="color: var(--gold); font-family: var(--font-mono); text-decoration: none; font-size: 0.9rem; padding: 0.5rem 0.9rem; border: 1.5px solid var(--gold); border-radius: 10px;">QR-Bestellung (/order)</a>
      <a href="/admin" style="color: var(--green-neon); font-family: var(--font-mono); text-decoration: none; font-size: 0.9rem; padding: 0.5rem 0.9rem; border: 1.5px solid var(--green-neon); border-radius: 10px;">Crew KDS (/admin)</a>
    </div>
  </header>

  <main class="board-grid">
    <section class="board-col">
      <h2 class="col-title">
        <span>🔥 IM WOK &amp; SCHÖPFEN</span>
        <span style="font-family: var(--font-mono); color: var(--gold);" id="inWokCount">0</span>
      </h2>
      <div class="code-grid" id="inWokList"></div>
    </section>

    <section class="board-col board-col--ready">
      <h2 class="col-title" style="color: var(--green-neon);">
        <span>🔔 ABHOLBEREIT AM TRUCK</span>
        <span style="font-family: var(--font-mono);" id="readyCount">0</span>
      </h2>
      <div class="code-grid" id="readyList"></div>
    </section>
  </main>

  <script>
    async function pollBoard() {
      try {
        const res = await fetch("/api/orders");
        const json = await res.json();
        if (!json.success) return;
        const orders = json.data.orders || [];

        const inPrep = orders.filter((o) => ["received", "in_wok", "plating"].includes(o.status));
        const ready = orders.filter((o) => o.status === "ready");

        document.getElementById("inWokCount").textContent = String(inPrep.length);
        document.getElementById("readyCount").textContent = String(ready.length);

        document.getElementById("inWokList").innerHTML = inPrep.length === 0
          ? '<div style="color:var(--muted);font-size:1.1rem;">Wok ist bereit für deine Bestellung...</div>'
          : inPrep.map((o) => \`
            <div class="flap-card">
              <span class="plz-big">\${o.zueriCode.plz}</span>
              <span class="quarter-big">\${o.zueriCode.quarter}</span>
            </div>
          \`).join("");

        document.getElementById("readyList").innerHTML = ready.length === 0
          ? '<div style="color:var(--muted);font-size:1.1rem;">Sobald dein Code hier grün aufleuchtet, kannst du deine Box abholen!</div>'
          : ready.map((o) => \`
            <div class="flap-card flap-card--ready">
              <span class="plz-big">\${o.zueriCode.plz}</span>
              <span class="quarter-big">\${o.zueriCode.quarter} 🔔</span>
            </div>
          \`).join("");
      } catch {}
    }

    pollBoard();
    setInterval(pollBoard, 1500);
  </script>
</body>
</html>`;
}
