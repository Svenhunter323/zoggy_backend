const User = require('../models/User');
const cfg = require('../config');

// GET /api/referrals
const getReferrals = async (req, res) => {
  try {
    const user = req.user;
    const baseUrl = cfg.telegram.publicBaseUrl || 'http://localhost:3000';
    const referralLink = `${baseUrl}?ref=${user.referralCode}`;

    res.json({
      referralLink,
      referralsCount: user.referralCount
    });
  } catch (error) {
    console.error('[referral] Get referrals error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

// GET /api/leaderboard/top10
const getLeaderboard = async (req, res) => {
  try {
    const topUsers = await User.find({ emailVerified: true })
      .sort({ referralCount: -1, createdAt: 1 })
      .limit(10)
      .select('email referralCount');

    const leaderboard = topUsers.map((user, index) => ({
      rank: index + 1,
      user: user.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email for privacy
      referrals: user.referralCount
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error('[referral] Get leaderboard error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

module.exports = {
  getReferrals,
  getLeaderboard
};