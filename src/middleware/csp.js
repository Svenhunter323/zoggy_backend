// server/csp.js
const helmet = require('helmet');
const cfg = require('../config');

/**
 * Build CSP directives for your app.
 * Env:
 *   NODE_ENV=production | development
 *   TG_WIDGET_MODE=onauth | authurl
 *   NGROK_HOST=38173443f296.ngrok-free.app   // only for dev via tunnel
 */

const getHost = url => (url.match(/https?:\/\/([^/]+)/) || [])[1];
function buildCspDirectives() {
  const isProd = process.env.NODE_ENV === 'production';
  const widgetMode = (process.env.TG_WIDGET_MODE || 'onauth').toLowerCase(); // 'onauth' | 'authurl'
  const ngrokHost = cfg.publicBaseUrl; // e.g. "38173443f296.ngrok-free.app"

  const directives = {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https://t.me", "https://telegram.org"],
    frameSrc: ["https://t.me", "https://telegram.org", "https://oauth.telegram.org"],
    connectSrc: [
      "'self'",
      "https://api.telegram.org",
      "https://t.me",
      "https://oauth.telegram.org",
      // if your frontend ever calls an https backend over ngrok in prod testing:
      "https://*.ngrok-free.app",
    ],
    // script-src differs by widget mode
    scriptSrc: ["'self'", "https://telegram.org"],
  };

  // data-onauth requires 'unsafe-eval' (Telegram widget evaluates the callback)
  if (widgetMode === 'onauth') {
    directives.scriptSrc.push("'unsafe-eval'");
    // If you *really* have inline <script> in your built HTML, add "'unsafe-inline'".
    // Try to avoid it in prod. Leave it out by default:
    // directives.scriptSrc.push("'unsafe-inline'");
  }

  // DEV allowances: HMR over WSS via ngrok tunnel
  if (!isProd && ngrokHost) {
    directives.connectSrc.push(`https://${getHost(ngrokHost)}`, `wss://${getHost(ngrokHost)}`);
  }

  return directives;
}

/**
 * Express middleware that applies the CSP headers with helmet.
 * Use this when you serve the built SPA (index.html) from Express.
 */
function cspMiddleware() {
  const directives = buildCspDirectives();

  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives,
    },
    // keep these relaxed for typical SPA/dev setups
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });
}

module.exports = {
  cspMiddleware,
  buildCspDirectives,
};
