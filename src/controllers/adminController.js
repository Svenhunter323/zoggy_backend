const User = require('../models/User');
const { toCsv } = require('../utils/csv');

// GET /api/admin/users
const getUsers = async (req, res) => {
  try {
    const query = {};
    if (req.query.email) {
      query.email = new RegExp(req.query.email, 'i');
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(1000)
      .select('email cents claimCode emailVerified telegramJoinedOk referralCount createdAt');

    const formattedUsers = users.map(user => ({
      email: user.email,
      totalCredits: (user.cents / 100).toFixed(2),
      claimCode: user.claimCode,
      emailVerified: user.emailVerified,
      telegramVerified: !!user.telegramJoinedOk,
      referrals: user.referralCount,
      createdAt: user.createdAt
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('[admin] Get users error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

// GET /api/admin/referrals
const getReferrals = async (req, res) => {
  try {
    const users = await User.find({ referralCount: { $gt: 0 } })
      .sort({ referralCount: -1 })
      .select('email referralCount')
      .limit(1000);

    const referrals = users.map(user => ({
      user: user.email,
      referralsCount: user.referralCount
    }));

    res.json(referrals);
  } catch (error) {
    console.error('[admin] Get referrals error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

// GET /api/admin/exports/claim-codes.csv
const exportClaimCodes = async (req, res) => {
  try {
    const users = await User.find({})
      .select('email claimCode cents referralCode referralCount emailVerified')
      .sort({ createdAt: 1 });

    const rows = users.map(user => ({
      email: user.email,
      claim_code: user.claimCode,
      credits_usd: (user.cents / 100).toFixed(2),
      referral_code: user.referralCode,
      referrals: user.referralCount,
      email_verified: user.emailVerified
    }));

    const csv = toCsv(rows);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="claim-codes.csv"');
    res.send(csv);
  } catch (error) {
    console.error('[admin] Export claim codes error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

module.exports = {
  getUsers,
  getReferrals,
  exportClaimCodes
};