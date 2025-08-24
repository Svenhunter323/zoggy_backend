const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDb = require('./db');
const cfg = require('./config');
const captureContext = require('./middleware/captureContext');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const telegramRoutes = require('./routes/telegram');
const { getBot } = require('./services/telegram');
const { startFakeWinsJob } = require('./jobs/fakeWins');

(async () => {
  await connectDb();

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(captureContext);

  // Basic rate limit (esp. signup)
  app.use('/api/waitlist', rateLimit({ windowMs: 60_000, max: 15 }));

  app.use('/api', publicRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/telegram', telegramRoutes);

  app.get('/health', (_, res) => res.json({ ok: true }));

  const server = app.listen(cfg.port, () => {
    console.log(`[api] listening on :${cfg.port}`);
  });

  // Telegram webhook init (if token set)
  const bot = getBot();
  if (bot && cfg.telegram.publicBaseUrl && cfg.telegram.webhookSecret) {
    const url = `${cfg.telegram.publicBaseUrl}/api/telegram/webhook/${cfg.telegram.webhookSecret}`;
    bot.telegram.setWebhook(url).then(() => {
      console.log('[tg] webhook set', url);
    }).catch(e => console.warn('[tg] webhook error', e.message));
  }

  // Start fake wins generator
  startFakeWinsJob();
})();
