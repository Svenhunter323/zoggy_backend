const express = require('express');
const router = express.Router();
const cfg = require('../config');
const { auth } = require('../middleware/auth');
const { login, getDeeplink, getVerifyStatus, reCheck, webHook, markAsVerified } = require('../controllers/telegramController');
// const { getBot, getMemberInfo } = require('../services/telegram');
const User = require('../models/User');

// 1) Telegram Login Widget callback
router.post("/login", auth, login);

// Frontend helper to generate deeplink
// GET /api/telegram/deeplink  -> returns t.me link with JWT payload
router.get('/deeplink', auth, getDeeplink);

// GET /api/telegram/verify-status
router.get('/verify-status', auth, getVerifyStatus);

router.get('/recheck', auth, reCheck);

// POST /api/telegram/verify - Mark user as verified after joining
router.post('/verify', auth, markAsVerified);

// Webhook for Telegram updates
router.post(`/webhook/${cfg.telegram.webhookSecret}`, webHook);

module.exports = router;
