const crypto = require('crypto');

/**
 * Build data_check_string from ALL fields except "hash"
 * sorted by key, each line "key=value"
 */
function buildDataCheckString(data) {
  return Object.keys(data)
    .filter(k => k !== 'hash' && data[k] !== undefined && data[k] !== null)
    .sort()
    .map(k => `${k}=${String(data[k])}`)
    .join('\n');
}

function safeEqHex(aHex, bHex) {
  try {
    const a = Buffer.from(String(aHex), 'hex');
    const b = Buffer.from(String(bHex), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verify Telegram Login Widget payload
 * @param {object} data - payload from req.body or req.query (flat, not nested)
 * @param {string} botToken - your exact bot token for the SAME bot used in the widget
 * @param {object} [opts]
 * @param {number} [opts.maxAgeSeconds=600]
 */
function verifyTelegramLogin(data, botToken, { maxAgeSeconds = 600 } = {}) {
  if (!data) return { ok: false, error: 'empty_payload' };

  const hash = data.hash ? String(data.hash) : null;
  if (!hash) return { ok: false, error: 'missing_hash' };
  if (!botToken) return { ok: false, error: 'missing_bot_token' };

  const dataCheckString = buildDataCheckString(data);

  // secret = sha256(bot_token)
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const hmacHex = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (!safeEqHex(hmacHex, hash)) return { ok: false, error: 'bad_signature' };

  // Optional freshness check
  const authDate = Number(data.auth_date);
  if (Number.isFinite(authDate)) {
    const now = Math.floor(Date.now() / 1000);
    const age = now - authDate;
    if (age > maxAgeSeconds) return { ok: false, error: 'stale_auth_date', age };
    if (age < -300) return { ok: false, error: 'future_auth_date', age };
  }

  return { ok: true, telegramId: String(data.id ?? '') };
}

module.exports = { verifyTelegramLogin };
