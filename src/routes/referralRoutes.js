const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getReferrals, getLeaderboard } = require('../controllers/referralController');

// GET /api/referrals
router.get('/', auth, getReferrals);

// GET /api/leaderboard/top10
router.get('/leaderboard/top10', getLeaderboard);

module.exports = router;