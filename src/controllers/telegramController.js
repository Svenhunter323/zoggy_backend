const jwt = require('jsonwebtoken');
const cfg = require('../config');
const User = require('../models/User');

// GET /api/telegram/deeplink
const getDeeplink = async (req, res) => {
  try {
    const user = req.user;
    
    if (!cfg.telegram.token || !process.env.TELEGRAM_BOT_USERNAME) {
      return res.status(503).json({ error: 'telegram_not_configured' });
    }

    // Create a token for the Telegram bot
    const token = jwt.sign(
      { sub: user._id.toString(), v: user.authVersion },
      cfg.jwtSecret,
      { expiresIn: '1h' }
    );

    const link = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`;

    res.json({ link });
  } catch (error) {
    console.error('[telegram] Get deeplink error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

// GET /api/telegram/verify-status
const getVerifyStatus = async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      telegramVerified: !!user.telegramJoinedOk
    });
  } catch (error) {
    console.error('[telegram] Get verify status error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

module.exports = {
  getDeeplink,
  getVerifyStatus
};