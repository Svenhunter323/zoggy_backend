const jwt = require('jsonwebtoken');
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
// POST /api/waitlist NOT use
router.post('/waitlist', async (req, res) => {
  try {
    const { email, ref } = req.body || {};
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'invalid_email_format' });

    // duplicate email check
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

    // Generate referral and claim codes
    const referralCode = newReferralCode();
    const claimCode = newClaimCode();

    // Handle referral code logic
    let referredBy = (ref || '').trim();
    if (referredBy) {
      const referredUser = await User.findOne({ referralCode: referredBy });
      if (!referredUser) {
        return res.status(400).json({ error: 'invalid_referral_code' });
      }
    }

    // Prevent self-referrals
    if (!cfg.antifraud.allowSelfRef && referredBy === referralCode) {
      referredBy = ''; // prevent self-ref
    }

    // Create new user
    const user = await User.create({
      email,
      referralCode,
      claimCode,
      referredBy,
      signupIp: req.ctx.ip,
      signupUa: req.ctx.ua,
      deviceId: req.ctx.deviceId,
    });

    // Increment inviter's referral count
    if (referredBy) {
      await User.updateOne({ referralCode: referredBy }, { $inc: { referralCount: 1 } });
    }

    // Create verification token
    const verificationToken = jwt.sign(
      { userId: user._id.toString(), type: 'email_verification' },
      cfg.jwtSecret,
      { expiresIn: '24h' }
    );

    const verificationLink = `${cfg.telegram.publicBaseUrl || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    // Send verification email
    await sendVerificationEmail(email, verificationLink);

    // Add user to Mailchimp
    addToList(email).catch((e) => console.error('Error adding to Mailchimp:', e));

    // Generate JWT token
    const token = sign(user);

    // Respond with the token and referral code
    res.json({ token, referralCode });
  } catch (e) {
    console.error('Error in /waitlist:', e);
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

// GET /api/stats - Platform statistics
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalReferrals = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$referralCount' } } }
    ]);
    
    res.json({
      totalUsers,
      totalReferrals: totalReferrals[0]?.total || 0
    });
  } catch (error) {
    console.error('[public] Get stats error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/wins/latest - Recent wins (alias for last-wins)
router.get('/wins/latest', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 24, 100);
    const items = await FakeWin.find().sort({ createdAt: -1 }).limit(limit);
    res.json(items.map(i => ({
      username: i.username,
      amount: i.amount,
      at: i.createdAt
    })));
  } catch (error) {
    console.error('[public] Get wins/latest error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/leaderboard/top10 - Top users by referrals
router.get('/leaderboard/top10', async (req, res) => {
  try {
    const topUsers = await User.find({ referralCount: { $gt: 0 } })
      .sort({ referralCount: -1, createdAt: 1 })
      .limit(10)
      .select('email referralCount createdAt')
      .lean();

    const leaderboard = topUsers.map((user, index) => ({
      rank: index + 1,
      email: user.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email for privacy
      referrals: user.referralCount,
      joinedAt: user.createdAt
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error('[public] Get leaderboard error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/last-wins (bots only, newest first) - Keep for backward compatibility
router.get('/last-wins', async (req, res) => {
  const items = await FakeWin.find().sort({ createdAt: -1 }).limit(50);
  res.json(items.map(i => ({
    username: i.username,
    amount: i.amount,
    at: i.createdAt
  })));
});

module.exports = router;
