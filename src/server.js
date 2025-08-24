const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDb = require('./db');
const cfg = require('./config');
const captureContext = require('./middleware/captureContext');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const telegramRoutes = require('./routes/telegramRoutes');
const authRoutes = require('./routes/authRoutes');
const chestRoutes = require('./routes/chestRoutes');
const referralRoutes = require('./routes/referralRoutes');
const { getBot } = require('./services/telegram');
const { startFakeWinsJob } = require('./jobs/fakeWins');

(async () => {
  await connectDb();

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(captureContext);

  // Basic rate limit (esp. signup)
  app.use('/api/waitlist', rateLimit({ windowMs: 60_000, max: 15 }));
  app.use('/api/auth/signup', rateLimit({ windowMs: 60_000, max: 10 }));
  app.use('/api/auth/signin', rateLimit({ windowMs: 60_000, max: 20 }));

  app.use('/api', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/chest', chestRoutes);
  app.use('/api/referrals', referralRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/telegram', telegramRoutes);

  // Serve static files from dist directory
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });

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
