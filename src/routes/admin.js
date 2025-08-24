const express = require('express');
const router = express.Router();
const { adminAuth, adminLogin } = require('../middleware/adminAuth');
const User = require('../models/User');
const { toCsv } = require('../utils/csv');

// POST /api/admin/login
router.post('/login', adminLogin);

// GET /api/admin/users
router.get('/users', adminAuth, async (req, res) => {
  const q = {};
  if (req.query.email) q.email = new RegExp(req.query.email, 'i');
  const users = await User.find(q).sort({ createdAt: -1 }).limit(1000);
  res.json(users);
});

// GET /api/admin/referrals - Get referral statistics
router.get('/referrals', adminAuth, async (req, res) => {
  try {
    const referralStats = await User.aggregate([
      {
        $group: {
          _id: '$referredBy',
          totalReferrals: { $sum: 1 },
          referrerEmail: { $first: '$referredBy' }
        }
      },
      {
        $match: { _id: { $ne: null, $ne: '' } }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'referralCode',
          as: 'referrer'
        }
      },
      {
        $project: {
          referralCode: '$_id',
          totalReferrals: 1,
          referrerEmail: { $arrayElemAt: ['$referrer.email', 0] },
          referrerCredits: { $arrayElemAt: ['$referrer.cents', 0] }
        }
      },
      { $sort: { totalReferrals: -1 } },
      { $limit: 100 }
    ]);

    const formattedStats = referralStats.map(stat => ({
      referralCode: stat.referralCode,
      referrerEmail: stat.referrerEmail,
      totalReferrals: stat.totalReferrals,
      referrerCredits: ((stat.referrerCredits || 0) / 100).toFixed(2)
    }));

    res.json(formattedStats);
  } catch (error) {
    console.error('[admin] Get referrals error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/admin/exports/claim-codes.csv - Export claim codes (frontend path)
router.get('/exports/claim-codes.csv', adminAuth, async (req, res) => {
  try {
    const users = await User.find({}, { 
      email: 1, 
      claimCode: 1, 
      cents: 1, 
      referralCode: 1, 
      referralCount: 1,
      createdAt: 1,
      telegramJoinedOk: 1,
      emailVerified: 1
    }).sort({ createdAt: 1 });
    
    const rows = users.map(u => ({
      email: u.email,
      claim_code: u.claimCode,
      credits_usd: (u.cents / 100).toFixed(2),
      referral_code: u.referralCode,
      referrals: u.referralCount,
      telegram_verified: u.telegramJoinedOk ? 'Yes' : 'No',
      email_verified: u.emailVerified ? 'Yes' : 'No',
      signup_date: u.createdAt.toISOString().split('T')[0]
    }));
    
    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="claim-codes.csv"');
    res.send(csv);
  } catch (error) {
    console.error('[admin] Export claim codes error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/admin/export/codes - Keep for backward compatibility
router.get('/export/codes', adminAuth, async (req, res) => {
  const users = await User.find({}, { email: 1, claimCode: 1, cents: 1, referralCode: 1, referralCount: 1 }).sort({ createdAt: 1 });
  const rows = users.map(u => ({
    email: u.email,
    claim_code: u.claimCode,
    credits_usd: (u.cents / 100).toFixed(2),
    referral_code: u.referralCode,
    referrals: u.referralCount
  }));
  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="codes.csv"');
  res.send(csv);
});

module.exports = router;
