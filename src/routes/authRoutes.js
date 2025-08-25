const express = require('express');
const router = express.Router();
const { signup, signin, verifyEmail, resendVerification } = require('../controllers/authController');

// POST /api/auth/signup
router.post('/signup', signup);

// POST /api/auth/signin
router.post('/signin', signin);

// POST /api/auth/verify-email
router.post('/verify-email', verifyEmail);

// POST /api/auth/resend-verification
router.post('/resend-verification', resendVerification);

// POST /api/auth/resend - Alias for frontend compatibility
router.post('/resend', resendVerification);

module.exports = router;