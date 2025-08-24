@@ .. @@
 const express = require('express');
 const router = express.Router();
 const cfg = require('../config');
+const { auth } = require('../middleware/auth');
+const { getDeeplink, getVerifyStatus } = require('../controllers/telegramController');
 const { getBot, isMember } = require('../services/telegram');
 const User = require('../models/User');
 const jwt = require('jsonwebtoken');
@@ .. @@
 
 // 3) Frontend helper to generate deeplink
 // GET /api/telegram/deeplink  -> returns t.me link with JWT payload
-router.get('/deeplink', async (req, res) => {
-  const token = (req.headers.authorization || '').replace('Bearer ', '');
-  try {
-    const payload = jwt.verify(token, cfg.jwtSecret);
-    const deep = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`;
-    res.json({ url: deep });
-  } catch {
-    res.status(401).json({ error: 'bad_token' });
-  }
-});
+router.get('/deeplink', auth, getDeeplink);
+
+// GET /api/telegram/verify-status
+router.get('/verify-status', auth, getVerifyStatus);
 
 module.exports = router;