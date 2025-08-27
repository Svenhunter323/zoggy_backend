const jwt = require('jsonwebtoken');
const cfg = require('../config');
const User = require('../models/User');
const { getBot, getMemberInfo } = require('../services/telegram');

// GET /api/telegram/deeplink
const getDeeplink = async (req, res) => {
  try {
    const user = req.user;
    
    if (!cfg.telegram.token || !process.env.TELEGRAM_BOT_USERNAME) {
      return res.status(503).json({ error: 'telegram_not_configured' });
    }

    // Create a token for the Telegram bot
    // const token = jwt.sign(
    //   { sub: user._id.toString(), v: user.authVersion },
    //   cfg.jwtSecret,
    //   { expiresIn: '1h' }
    // );

    const token = `${user._id.toString()}_${user.authVersion}`;

    const link = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`;

    res.json({ link });
  } catch (error) {
    console.error('[telegram] Get deeplink error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

// GET /api/telegram/verify-status
const getVerifyStatus = async (req, res) => {
  const user = req.user;
  if (!user.telegramUserId) {
    return res.json({ linked: false, joined: false });
  }
  const bot = getBot();
  if (!bot || !cfg.telegram.channelId) {
    return res.status(503).json({ error: 'telegram_not_configured' });
  }
  const info = await getMemberInfo(bot.telegram, cfg.telegram.channelId, user.telegramUserId);
  if (info.ok && !user.telegramJoinedOk) {
    await User.updateOne({ _id: user._id }, { $set: { telegramJoinedOk: true } });
  }
  res.json({
    linked: true,
    joined: !!info.ok,
    status: info.status || null,
    error: info.error || null
  });
};

// POST /api/telegram/verify
const markAsVerified = async (req, res) => {
  const user = req.user;
  if (!user.telegramUserId) {
    return res.status(400).json({ error: 'telegram_not_linked' });
  }
  const bot = getBot();
  if (!bot || !cfg.telegram.channelId) {
    return res.status(503).json({ error: 'telegram_not_configured' });
  }
  const info = await getMemberInfo(bot.telegram, cfg.telegram.channelId, user.telegramUserId);
  if (!info.ok) {
    return res.status(403).json({ error: 'not_a_member', status: info.status, detail: info.error });
  }
  await User.updateOne({ _id: user._id }, { $set: { telegramJoinedOk: true } });
  res.json({ success: true });
};

module.exports = {
  getDeeplink,
  getVerifyStatus,
  markAsVerified
};