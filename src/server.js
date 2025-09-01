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
const { getBot, initBotPolling } = require('./services/telegram');
const { startFakeWinsJob } = require('./jobs/fakeWins');
const { cspMiddleware } = require('./middleware/csp');

(async () => {
  await connectDb();

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  // app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(captureContext);

  // Apply CSP to everything, or wrap only HTML routes if you prefer
  // app.use(cspMiddleware());

  // CORS configuration for frontend (optional but recommended)
  // ----- CORS (credentials-safe) -----
  // Put your real frontends here or use env var CSV
  // allowlist your real frontends
  const ALLOWED_ORIGINS = [
    'https://zoggybet.com',
    'https://www.zoggybet.com',
    'https://zoggybet.vercel.app'
  ];

  const corsOptions = {
    origin(origin, cb) {
      if (!origin) return cb(null, true);          // non-browser clients
      cb(null, ALLOWED_ORIGINS.includes(origin));  // true = allow, false = block
    },
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));   // preflight
  // -----------------------------------

  app.get('/api/ip', (req, res) => {
    res.json({ ip: req.ip });
  });
  // app.get('/proxy/ipapi', async (req, res) => {
  //   try {
  //     const response = await axios.get('https://ipapi.co/json/');
  //     res.json(response.data);  // Send the API response back to the frontend
  //   } catch (error) {
  //     res.status(500).send({ error: 'Error fetching data from ipapi.co' });
  //   }
  // });

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

  app.get('/health', (_, res) => res.json({ ok: true }));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });


  const server = app.listen(cfg.port, async () => {
    console.log(`[api] listening on :${cfg.port}`);
    
    await initBotPolling();
  });

})();