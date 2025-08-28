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
const { cspMiddleware } = require('./middleware/csp');

(async () => {
  await connectDb();

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(captureContext);

  // Apply CSP to everything, or wrap only HTML routes if you prefer
  app.use(cspMiddleware());

  // CORS configuration for frontend (optional but recommended)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');  // Allow all domains (or specify your frontend URL)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
  });
  app.get('/api/ip', (req, res) => {
    res.json({ ip: req.ip });
  });
  app.get('/proxy/ipapi', async (req, res) => {
    try {
      const response = await axios.get('https://ipapi.co/json/');
      res.json(response.data);  // Send the API response back to the frontend
    } catch (error) {
      res.status(500).send({ error: 'Error fetching data from ipapi.co' });
    }
  });

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
  if (bot && cfg.publicBaseUrl && cfg.telegram.webhookSecret) {
    const url = `${cfg.publicBaseUrl}/api/telegram/webhook/${cfg.telegram.webhookSecret}`;
    bot.telegram.setWebhook(url, {
      // extra protection so only Telegram can hit the route:
      secret_token: cfg.telegram.webhookSecretToken || undefined,
      drop_pending_updates: true,
      allowed_updates: ['message', 'chat_join_request', 'chat_member'], // <<<
    }).then(() => {
      console.log('[tg] webhook set', url);
    }).catch(e => console.warn('[tg] webhook error', e.message));
   }

  // Start fake wins generator
  // startFakeWinsJob();
})();
