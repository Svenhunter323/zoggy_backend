@@ .. @@
 const express = require('express');
 const router = express.Router();
 const { adminAuth, adminLogin } = require('../middleware/adminAuth');
-const User = require('../models/User');
-const { toCsv } = require('../utils/csv');
+const { getUsers, getReferrals, exportClaimCodes } = require('../controllers/adminController');
 
 // POST /api/admin/login
 router.post('/login', adminLogin);
 
 // GET /api/admin/users
-router.get('/users', adminAuth, async (req, res) => {
-  const q = {};
-  if (req.query.email) q.email = new RegExp(req.query.email, 'i');
-  const users = await User.find(q).sort({ createdAt: -1 }).limit(1000);
-  res.json(users);
-});
+router.get('/users', adminAuth, getUsers);
+
+// GET /api/admin/referrals
+router.get('/referrals', adminAuth, getReferrals);
 
-// GET /api/admin/export/codes
-router.get('/export/codes', adminAuth, async (req, res) => {
-  const users = await User.find({}, { email: 1, claimCode: 1, cents: 1, referralCode: 1, referralCount: 1 }).sort({ createdAt: 1 });
-  const rows = users.map(u => ({
-    email: u.email,
-    claim_code: u.claimCode,
-    credits_usd: (u.cents / 100).toFixed(2),
-    referral_code: u.referralCode,
-    referrals: u.referralCount
-  }));
-  const csv = toCsv(rows);
-  res.setHeader('Content-Type', 'text/csv');
-  res.setHeader('Content-Disposition', 'attachment; filename="codes.csv"');
-  res.send(csv);
-});
+// GET /api/admin/exports/claim-codes.csv
+router.get('/exports/claim-codes.csv', adminAuth, exportClaimCodes);
 
 module.exports = router;