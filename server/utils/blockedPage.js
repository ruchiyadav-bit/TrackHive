/**
 * Shared "Access Restricted" blocked page.
 * Intentionally generic — no TrackHive branding, no technical detail, and no
 * mention of *why* the visitor was blocked (bot, geo, frequency cap, etc.).
 * The visitor should never be able to learn the block reason from the page.
 */

const DEFAULT_BLOCKED_MESSAGE = 'This offer isn\u2019t available for your account right now.';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderBlockedPage(message = DEFAULT_BLOCKED_MESSAGE) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="robots" content="noindex, nofollow">
    <title>Access Restricted</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      html, body { width: 100%; min-height: 100%; }
      body {
        margin: 0;
        background:
          radial-gradient(circle at 50% 42%, rgba(219, 234, 254, .52), transparent 42%),
          #f8fafc;
        color: #0f274a;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .restricted-page {
        display: grid;
        min-height: 100vh;
        min-height: 100svh;
        place-items: center;
        padding: clamp(24px, 5vw, 64px);
      }
      .restricted-content {
        width: min(100%, 720px);
        text-align: center;
      }
      .restricted-illustration {
        display: block;
        width: min(100%, 520px);
        height: auto;
        margin: 0 auto clamp(20px, 3vw, 34px);
      }
      h1 {
        margin: 0;
        font-size: 25px;
        font-weight: 750;
        letter-spacing: -.035em;
        line-height: 1.15;
      }
      p {
        max-width: 610px;
        margin: clamp(14px, 2vw, 20px) auto 0;
        color: #52647e;
        font-size: 13px;
        line-height: 1.6;
      }
      @media (max-width: 600px) {
        .restricted-page { padding: 24px 20px; }
        .restricted-content { width: min(100%, 360px); }
        .restricted-illustration {
          width: min(100%, 300px);
          margin-bottom: 24px;
        }
        h1 { font-size: 20px; }
        p { font-size: 12px; line-height: 1.55; }
      }
      @media (max-height: 650px) {
        .restricted-page { padding-block: 18px; }
        .restricted-illustration {
          width: min(100%, 360px);
          max-height: 46vh;
          object-fit: contain;
          margin-bottom: 16px;
        }
      }
    </style>
  </head>
  <body>
    <main class="restricted-page">
      <section class="restricted-content" aria-labelledby="restricted-title">
        <img
          class="restricted-illustration"
          src="/click/access-restricted.png"
          alt=""
          width="900"
          height="600"
        >
        <h1 id="restricted-title">You don\u2019t have access to this page</h1>
        <p>${escapeHtml(message)}</p>
      </section>
    </main>
  </body>
</html>`;
}

/**
 * Send the blocked page response.
 * @param {import('express').Response} res
 * @param {{ statusCode?: number, message?: string }} [opts]
 */
function sendBlockedPage(res, opts = {}) {
  const { statusCode = 403, message } = opts;
  res.set('Cache-Control', 'no-store');
  res.status(statusCode).send(renderBlockedPage(message));
}

module.exports = { renderBlockedPage, sendBlockedPage, DEFAULT_BLOCKED_MESSAGE };
