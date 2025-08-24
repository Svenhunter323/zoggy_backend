const express = require('express');
const router = express.Router();
const cfg = require('../config');
const { getBot, isMember } = require('../services/telegram');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// 1) Webhook for Telegram updates
router.use(`/webhook/${cfg.telegram.webhookSecret}`, async (req, res) => {
  const bot = getBot();
  if (!bot) return res.sendStatus(200);
  try {
    await bot.handleUpdate(req.body);
  } catch (e) {
    console.error('[tg] update error', e.message);
  }
  res.sendStatus(200);
});

// 2) Set up bot handlers once
(function initBot() {
  const bot = getBot();
  if (!bot) return;

  // Command: /start <token>
  bot.start(async (ctx) => {
    const payload = ctx.startPayload; // JWT with userId
    if (!payload) return ctx.reply('Invalid start link.');
    let userId;
    try {
      const data = jwt.verify(payload, cfg.jwtSecret);
      userId = data.sub;
    } catch {
      return ctx.reply('Link expired. Open the site and connect again.');
    }

    // mark telegram account
    const u = await User.findById(userId);
    if (!u) return ctx.reply('Account not found.');
    u.telegramUserId = ctx.from.id;
    u.telegramUsername = ctx.from.username;
    await u.save();

    // verify membership
    const ok = await isMember(ctx.telegram, cfg.telegram.channelId, ctx.from.id);
    if (ok) {
      await User.updateOne({ _id: u._id }, { $set: { telegramJoinedOk: true } });
      return ctx.reply('✅ Verified! You can open your daily chest now.');
    } else {
      return ctx.reply('Please join our channel first, then click /verify');
    }
  });

  bot.command('verify', async (ctx) => {
    const u = await User.findOne({ telegramUserId: ctx.from.id });
    if (!u) return ctx.reply('No linked account. Use your site to connect again.');
    const ok = await isMember(ctx.telegram, cfg.telegram.channelId, ctx.from.id);
    if (ok) {
      await User.updateOne({ _id: u._id }, { $set: { telegramJoinedOk: true } });
      return ctx.reply('✅ Verified! You can open your daily chest now.');
    }
    return ctx.reply('Still not a member. Join the channel and try /verify again.');
  });
})();

// 3) Frontend helper to generate deeplink
// GET /api/telegram/deeplink  -> returns t.me link with JWT payload
router.get('/deeplink', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, cfg.jwtSecret);
    const deep = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`;
    res.json({ url: deep });
  } catch {
    res.status(401).json({ error: 'bad_token' });
  }
});

module.exports = router;
