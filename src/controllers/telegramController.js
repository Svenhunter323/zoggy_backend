const jwt = require('jsonwebtoken');
const cfg = require('../config');
const User = require('../models/User');
const { getBot, isMember } = require('../services/telegram');

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
    
    // If user is already marked as verified, return true
    if (user.telegramJoinedOk) {
      return res.json({ telegramVerified: true });
    }

    // If user has telegramUserId, check current membership status
    if (user.telegramUserId && cfg.telegram.channelId) {
      const bot = getBot();
      if (bot) {
        const isCurrentlyMember = await isMember(
          bot.telegram,
          cfg.telegram.channelId,
          user.telegramUserId
        );
        
        // If they're a member now, mark them as verified
        if (isCurrentlyMember) {
          await User.findByIdAndUpdate(user._id, {
            telegramJoinedOk: true
          });
          return res.json({ telegramVerified: true });
        }
      }
    }
    
    res.json({ telegramVerified: false });
  } catch (error) {
    console.error('[telegram] Get verify status error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

// POST /api/telegram/verify - Mark user as verified after joining
const markAsVerified = async (req, res) => {
  try {
    const user = req.user;
    const { telegramUserId } = req.body;
    
    if (!telegramUserId) {
      return res.status(400).json({ error: 'telegram_user_id_required' });
    }

    if (!cfg.telegram.channelId) {
      return res.status(503).json({ error: 'telegram_channel_not_configured' });
    }

    const bot = getBot();
    if (!bot) {
      return res.status(503).json({ error: 'telegram_bot_not_configured' });
    }

    // Check if user is actually a member of the channel
    const isCurrentlyMember = await isMember(
      bot.telegram,
      cfg.telegram.channelId,
      telegramUserId
    );

    if (!isCurrentlyMember) {
      return res.status(400).json({ error: 'not_a_member' });
    }

    // Update user record
    await User.findByIdAndUpdate(user._id, {
      telegramJoinedOk: true,
      telegramUserId: telegramUserId
    });

    res.json({ 
      success: true,
      telegramVerified: true
    });
  } catch (error) {
    console.error('[telegram] Mark as verified error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

module.exports = {
  getDeeplink,
  getVerifyStatus,
  markAsVerified
};