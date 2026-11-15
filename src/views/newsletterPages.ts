import { FONT_LINK, LEGAL_LINKS_HTML, scriptJson } from './shared.js';

/**
 * Pages behind the links in the newsletter e-mails.
 * Opening the page changes nothing: the guest confirms or unsubscribes with one tap (POST).
 * That keeps mail scanners that pre-open links from confirming on someone's behalf.
 */
export function renderNewsletterActionHtml(action: 'confirm' | 'unsubscribe', token: string): string {
  const isConfirm = action === 'confirm';
  const cfg = scriptJson({
    endpoint: isConfirm ? '/api/newsletter/confirm' : '/api/newsletter/unsubscribe',
    // Only well-formed tokens reach the script; anything else is treated as a broken link.
    token: /^[0-9a-f]{64}$/.test(token) ? token : '',
    done: isConfirm
      ? '✓ Bestätigt. Du erhältst ab jetzt den Holy Basil Tour-Alert.'
      : '✓ Abgemeldet. Deine Adresse ist gelöscht.',
  });
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>HOLY BASIL · Tour-Alert</title>
  <link rel="icon" href="/assets/holy_basil_logo_v7_team_stacked_sticker.svg" type="image/svg+xml">
  ${FONT_LINK}
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #0A0C0A; color: #F5F7F5; padding: 1rem;
      font-family: "Plus Jakarta Sans", system-ui, sans-serif;
    }
    .card {
      width: 100%; max-width: 420px; background: #121814; border: 2px solid rgba(82, 196, 90, 0.45);
      border-radius: 20px; padding: 1.75rem; text-align: center;
    }
    img { width: 84px; height: 84px; }
    h1 { font-family: "Space Grotesk", system-ui, sans-serif; font-size: 1.3rem; margin: 0.75rem 0 0.4rem 0; }
    p { color: #9FB0A2; font-size: 0.92rem; margin: 0 0 1rem 0; }
    button {
      width: 100%; min-height: 52px; border-radius: 12px; border: 0; background: #52C45A; color: #071209;
      font-weight: 800; font-size: 1rem; cursor: pointer; font-family: inherit;
    }
    button:disabled { opacity: 0.6; cursor: wait; }
    #msg { min-height: 1.3rem; margin-top: 0.8rem; font-size: 0.92rem; font-weight: 700; }
    .foot { margin-top: 1.2rem; font-size: 0.75rem; }
    a { color: #9FB0A2; }
  </style>
</head>
<body>
  <div class="card">
    <img src="/assets/holy_basil_logo_v7_team_stacked_sticker.svg" alt="Holy Basil">
    <h1>${isConfirm ? 'Tour-Alert bestätigen' : 'Tour-Alert abmelden'}</h1>
    <p>${
      isConfirm
        ? 'Mit einem Tap bestätigst du, dass du den Holy Basil Tour-Alert per E-Mail erhalten möchtest.'
        : 'Mit einem Tap meldest du dich ab. Wir löschen deine E-Mail-Adresse.'
    }</p>
    <button type="button" id="actionBtn">${isConfirm ? 'Anmeldung bestätigen' : 'Jetzt abmelden'}</button>
    <div id="msg" role="status"></div>
    <div class="foot"><a href="/">Zur Startseite</a> · ${LEGAL_LINKS_HTML}</div>
  </div>
  <script>
    const CFG = ${cfg};
    const btn = document.getElementById("actionBtn");
    const msg = document.getElementById("msg");
    if (!CFG.token) {
      btn.disabled = true;
      msg.style.color = "#FF8A80";
      msg.textContent = "Der Link ist unvollständig. Bitte den ganzen Link aus der E-Mail öffnen.";
    }
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      msg.textContent = "";
      try {
        const res = await fetch(CFG.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: CFG.token })
        });
        const json = await res.json();
        if (json.success) {
          msg.style.color = "#52C45A";
          msg.textContent = CFG.done;
          btn.style.display = "none";
          return;
        }
        msg.style.color = "#FF8A80";
        msg.textContent = (json.error && json.error.message) || "Das hat nicht geklappt.";
      } catch {
        msg.style.color = "#FF8A80";
        msg.textContent = "Keine Verbindung. Bitte nochmals versuchen.";
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
