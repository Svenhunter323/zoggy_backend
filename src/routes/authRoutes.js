const express = require('express');
const router = express.Router();
const { signup, signin, verifyEmail, resendVerification } = require('../controllers/authController');

// POST /api/auth/signup
router.post('/signup', signup);

// POST /api/auth/signin
router.post('/signin', signin);

// GET /api/auth/verify-email
router.get('/verify-email', verifyEmail);

// POST /api/auth/resend-verification
router.post('/resend-verification', resendVerification);

module.exports = router;