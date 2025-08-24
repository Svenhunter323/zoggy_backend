const express = require('express');
const router = express.Router();
const cfg = require('../config');
const { auth } = require('../middleware/auth');
const { getDeeplink, getVerifyStatus, markAsVerified } = require('../controllers/telegramController');
const { getBot, isMember } = require('../services/telegram');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Webhook for Telegram updates
router.post(`/webhook/${cfg.telegram.webhookSecret}`, async (req, res) => {
  try {
    const bot = getBot();
    if (!bot) {
      console.warn('[tg] Bot not configured, ignoring webhook');
      return res.status(200).send('ok');
    }

    const { message, callback_query } = req.body;
    
    // Validate webhook payload
    if (!message && !callback_query) {
      console.warn('[tg] Invalid webhook payload received');
      return res.status(400).json({ error: 'Invalid Telegram message' });
    }

    // Handle the update
    await bot.handleUpdate(req.body);
    
    // Additional processing for membership verification
    if (message && message.from) {
      const userId = message.from.id;
      await handleUserInteraction(userId, message);
    }
    
    res.status(200).send('ok');
  } catch (error) {
    console.error('[tg] Webhook error:', error.message);
    res.status(500).send('Error processing webhook');
  }
});

// Handle user interactions for verification
const handleUserInteraction = async (telegramUserId, message) => {
  try {
    // Find user by telegram ID
    const user = await User.findOne({ telegramUserId });
    if (!user) return;

    // Check if user is now a member and update status
    if (cfg.telegram.channelId) {
      const bot = getBot();
      const isMemberNow = await isMember(bot.telegram, cfg.telegram.channelId, telegramUserId);
      
      if (isMemberNow && !user.telegramJoinedOk) {
        await User.updateOne(
          { _id: user._id }, 
          { $set: { telegramJoinedOk: true } }
        );
        console.log(`[tg] Auto-verified user ${user._id} via interaction`);
      }
    }
  } catch (error) {
    console.error('[tg] Error handling user interaction:', error.message);
  }
};

// Initialize bot handlers
(function initBot() {
  const bot = getBot();
  if (!bot) return;

  // Command: /start <token>
  bot.start(async (ctx) => {
    try {
      const payload = ctx.startPayload; // JWT with userId
      if (!payload) {
        return ctx.reply('❌ Invalid start link. Please get a new link from the website.');
      }
      
      let userId;
      try {
        const data = jwt.verify(payload, cfg.jwtSecret);
        userId = data.sub;
        
        // Validate auth version if present
        if (data.v !== undefined) {
          const user = await User.findById(userId);
          if (!user || user.authVersion !== data.v) {
            return ctx.reply('🔒 Session expired. Please get a new link from the website.');
          }
        }
      } catch (error) {
        console.error('[tg] JWT verification failed:', error.message);
        return ctx.reply('🔒 Link expired or invalid. Please get a new link from the website.');
      }

      // Find and update user account
      const user = await User.findById(userId);
      if (!user) {
        return ctx.reply('❌ Account not found. Please contact support.');
      }
      
      // Link Telegram account
      user.telegramUserId = ctx.from.id;
      user.telegramUsername = ctx.from.username || null;
      await user.save();
      
      console.log(`[tg] Linked Telegram account for user ${userId}`);

      // Check channel membership
      if (!cfg.telegram.channelId) {
        return ctx.reply('⚠️ Channel not configured. Please contact support.');
      }
      
      const isChannelMember = await isMember(ctx.telegram, cfg.telegram.channelId, ctx.from.id);
      
      if (isChannelMember) {
        await User.updateOne({ _id: user._id }, { $set: { telegramJoinedOk: true } });
        return ctx.reply('🎉 Verification successful! You can now open your daily chest.');
      } else {
        const channelHandle = process.env.TG_CHANNEL_HANDLE || '@zoggycasino';
        return ctx.reply(
          `📢 Please join our channel first: ${channelHandle}\n\n` +
          'After joining, use the /verify command to complete verification.'
        );
      }
    } catch (error) {
      console.error('[tg] Start command error:', error.message);
      return ctx.reply('❌ An error occurred. Please try again or contact support.');
    }
  });

  bot.command('verify', async (ctx) => {
    try {
      const user = await User.findOne({ telegramUserId: ctx.from.id });
      if (!user) {
        return ctx.reply('❌ No linked account found. Please get a new verification link from the website.');
      }
      
      if (!cfg.telegram.channelId) {
        return ctx.reply('⚠️ Channel not configured. Please contact support.');
      }
      
      const isChannelMember = await isMember(ctx.telegram, cfg.telegram.channelId, ctx.from.id);
      if (isChannelMember) {
        await User.updateOne({ _id: user._id }, { $set: { telegramJoinedOk: true } });
        console.log(`[tg] Manual verification completed for user ${user._id}`);
        return ctx.reply('🎉 Verification successful! You can now open your daily chest.');
      } else {
        const channelHandle = process.env.TG_CHANNEL_HANDLE || '@zoggycasino';
        return ctx.reply(
          `❌ You are not a member of our channel yet.\n\n` +
          `Please join: ${channelHandle}\n\n` +
          'Then try /verify again.'
        );
      }
    } catch (error) {
      console.error('[tg] Verify command error:', error.message);
      return ctx.reply('❌ An error occurred during verification. Please try again.');
    }
  });
})();

// 3) Frontend helper to generate deeplink
// GET /api/telegram/deeplink  -> returns t.me link with JWT payload
router.get('/deeplink', auth, getDeeplink);

// GET /api/telegram/verify-status
router.get('/verify-status', auth, getVerifyStatus);

// POST /api/telegram/verify - Mark user as verified after joining
router.post('/verify', auth, markAsVerified);

module.exports = router;