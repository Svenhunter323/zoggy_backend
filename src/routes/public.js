const express = require('express');
const router = express.Router();
const { sign, auth } = require('../middleware/auth');
const User = require('../models/User');
const ChestOpen = require('../models/ChestOpen');
const FakeWin = require('../models/FakeWin');
const { newReferralCode, newClaimCode } = require('../utils/ids');
const { drawReward } = require('../services/rewards');
const { addToList } = require('../services/mailchimp');
const cfg = require('../config');

// Anti-fraud helper
async function ipSignupCount(ip) {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  return User.countDocuments({ signupIp: ip, createdAt: { $gte: since } });
}

// GET /api/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = req.user;
    
    const nextChestAt = user.lastOpenAt 
      ? new Date(user.lastOpenAt.getTime() + 24 * 3600 * 1000)
      : new Date();

    res.json({
      email: user.email,
      totalCredits: (user.cents / 100).toFixed(2),
      claimCode: user.claimCode,
      nextChestAt: nextChestAt.toISOString(),
      lastChestOpenAt: user.lastOpenAt ? user.lastOpenAt.toISOString() : null,
      telegramVerified: !!user.telegramJoinedOk,
      emailVerified: user.emailVerified
    });
  } catch (error) {
    console.error('[public] Get me error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/waitlist
router.post('/waitlist', async (req, res) => {
  try {
    const { email, ref } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email_required' });

    // duplicate email block
    const existing = await User.findOne({ email });
    if (existing) {
      const token = sign(existing);
      return res.json({ token, referralCode: existing.referralCode });
    }

    // IP/device throttling
    const ip = req.ctx.ip;
    const count = await ipSignupCount(ip);
    if (count >= cfg.antifraud.maxPerIpPerDay) {
      return res.status(429).json({ error: 'too_many_signups_from_ip' });
    }

    const referralCode = newReferralCode();
    const claimCode = newClaimCode();

    let referredBy = (ref || '').trim();
    if (!cfg.antifraud.allowSelfRef && referredBy && referredBy === referralCode) {
      referredBy = ''; // prevent self-ref
    }

    const user = await User.create({
      email,
      referralCode,
      claimCode,
      referredBy,
      signupIp: req.ctx.ip,
      signupUa: req.ctx.ua,
      deviceId: req.ctx.deviceId
    });

    // increment inviter referralCount
    if (referredBy) {
      await User.updateOne({ referralCode: referredBy }, { $inc: { referralCount: 1 } });
    }

    addToList(email).catch(() => {});

    const token = sign(user);
    res.json({ token, referralCode });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/dashboard
router.get('/dashboard', auth, async (req, res) => {
  const u = req.user;

  // position: rank by (referralCount desc, createdAt asc)
  const ahead = await User.countDocuments({
    $or: [
      { referralCount: { $gt: u.referralCount } },
      { referralCount: u.referralCount, createdAt: { $lt: u.createdAt } }
    ]
  });

  const total = await User.countDocuments();

  res.json({
    email: u.email,
    referralCode: u.referralCode,
    claimCode: u.claimCode,
    referrals: u.referralCount,
    position: ahead + 1,
    total,
    cents: u.cents,
    balance: (u.cents / 100).toFixed(2),
    telegram: { linked: !!u.telegramUserId, verified: !!u.telegramJoinedOk },
    lastOpenAt: u.lastOpenAt,
    openCount: u.openCount,
    cooldownSeconds: u.lastOpenAt ? Math.max(0, Math.floor(24 * 3600 - (Date.now() - u.lastOpenAt.getTime()) / 1000)) : 0
  });
});

// POST /api/open-chest
router.post('/open-chest', auth, async (req, res) => {
  const u = req.user;

  // Telegram gate
  if (!u.telegramJoinedOk) {
    return res.status(403).json({ error: 'telegram_required' });
  }

  // cooldown 24h
  if (u.lastOpenAt && Date.now() - u.lastOpenAt.getTime() < 24 * 3600 * 1000) {
    return res.status(429).json({ error: 'cooldown_active' });
  }

  const isFirst = !u.firstChestOpened;
  const cents = drawReward(isFirst);

  u.cents += cents;
  u.firstChestOpened = true;
  u.lastOpenAt = new Date();
  u.openCount += 1;
  await u.save();

  await ChestOpen.create({
    userId: u._id,
    amountCents: cents,
    isFirstChest: isFirst
  });

  res.json({ cents, amount: (cents / 100).toFixed(2) });
});

// GET /api/last-wins (bots only, newest first)
router.get('/last-wins', async (req, res) => {
  const items = await FakeWin.find().sort({ createdAt: -1 }).limit(50);
  res.json(items.map(i => ({
    username: i.username,
    amount: i.amount,
    at: i.createdAt
  })));
});

module.exports = router;
