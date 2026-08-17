/**
 * Shared "Access Restricted" blocked page.
 * Intentionally generic — no TrackHive branding, no technical detail, and no
 * mention of *why* the visitor was blocked (bot, geo, frequency cap, etc.).
 * The visitor should never be able to learn the block reason from the page.
 */

const DEFAULT_BLOCKED_MESSAGE = 'This offer is not available at the moment.';

function renderBlockedPage(message = DEFAULT_BLOCKED_MESSAGE) {
  return `
    <html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb">
      <div style="text-align:center;max-width:400px;padding:40px">
        <h2 style="color:#1f2937">Access Restricted</h2>
        <p style="color:#6b7280">${message}</p>
      </div>
    </body></html>
  `;
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
