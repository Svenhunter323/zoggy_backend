const User = require('../models/User');
const ChestOpen = require('../models/ChestOpen');
const { drawReward } = require('../services/rewards');

// POST /api/chest/open
const openChest = async (req, res) => {
  try {
    const user = req.user;

    // Check email verification
    if (!user.emailVerified) {
      return res.status(403).json({ error: 'email_not_verified' });
    }

    // Telegram gate
    if (!user.telegramJoinedOk) {
      return res.status(403).json({ error: 'telegram_required' });
    }

    // Cooldown check (24 hours)
    if (user.lastOpenAt && Date.now() - user.lastOpenAt.getTime() < 24 * 3600 * 1000) {
      const nextChestAt = new Date(user.lastOpenAt.getTime() + 24 * 3600 * 1000);
      return res.status(429).json({ 
        error: 'cooldown_active',
        nextChestAt: nextChestAt.toISOString()
      });
    }

    const isFirst = !user.firstChestOpened;
    const cents = drawReward(isFirst);

    // Update user
    user.cents += cents;
    user.firstChestOpened = true;
    user.lastOpenAt = new Date();
    user.openCount += 1;
    await user.save();

    // Log chest opening
    await ChestOpen.create({
      userId: user._id,
      amountCents: cents,
      isFirstChest: isFirst
    });

    const nextChestAt = new Date(Date.now() + 24 * 3600 * 1000);

    res.json({
      reward: `$${(cents / 100).toFixed(2)}`,
      nextChestAt: nextChestAt.toISOString()
    });
  } catch (error) {
    console.error('[chest] Open chest error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

module.exports = {
  openChest
};