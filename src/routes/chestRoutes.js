const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { openChest } = require('../controllers/chestController');

// POST /api/chest/open
router.post('/open', auth, openChest);

module.exports = router;