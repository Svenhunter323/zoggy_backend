const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { newReferralCode, newClaimCode } = require('../utils/ids');
const { addToList } = require('../services/mailchimp');
const cfg = require('../config');

// Create email transporter
const createTransporter = () => {
  if (cfg.mailtrap.host) {
    return nodemailer.createTransporter({
      host: cfg.mailtrap.host,
      port: cfg.mailtrap.port,
      auth: {
        user: cfg.mailtrap.username,
        pass: cfg.mailtrap.password
      }
    });
  }
  return null;
};

// Send verification email
const sendVerificationEmail = async (email, verificationLink) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[auth] No email transporter configured');
    return;
  }

  const mailOptions = {
    from: cfg.mailchimp.from || 'noreply@zoggy.com',
    to: email,
    subject: 'Verify Your Email - Zoggy Casino',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Zoggy Casino!</h2>
        <p>Please verify your email address by clicking the button below:</p>
        <a href="${verificationLink}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email</a>
        <p>Or copy and paste this link in your browser:</p>
        <p>${verificationLink}</p>
        <p>This link will expire in 24 hours.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('[auth] Verification email sent to:', email);
  } catch (error) {
    console.error('[auth] Error sending verification email:', error.message);
  }
};

// Anti-fraud helper
async function ipSignupCount(ip) {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  return User.countDocuments({ signupIp: ip, createdAt: { $gte: since } });
}

// POST /api/auth/signup
const signup = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email_required' });

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'email_already_exists' });
    }

    // IP/device throttling
    const ip = req.ctx.ip;
    const count = await ipSignupCount(ip);
    if (count >= cfg.antifraud.maxPerIpPerDay) {
      return res.status(429).json({ error: 'too_many_signups_from_ip' });
    }

    const referralCode = newReferralCode();
    const claimCode = newClaimCode();

    const user = await User.create({
      email,
      referralCode,
      claimCode,
      emailVerified: false,
      signupIp: req.ctx.ip,
      signupUa: req.ctx.ua,
      deviceId: req.ctx.deviceId
    });

    // Create verification token
    const verificationToken = jwt.sign(
      { userId: user._id.toString(), type: 'email_verification' },
      cfg.jwtSecret,
      { expiresIn: '24h' }
    );

    const verificationLink = `${cfg.telegram.publicBaseUrl || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    // Send verification email
    await sendVerificationEmail(email, verificationLink);

    // Add to Mailchimp list
    addToList(email).catch(() => {});

    res.json({ message: 'Signup successful. Please verify your email.' });
  } catch (error) {
    console.error('[auth] Signup error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

// POST /api/auth/signin
const signin = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email_required' });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ error: 'email_not_verified' });
    }

    const token = jwt.sign(
      { sub: user._id.toString(), v: user.authVersion },
      cfg.jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        email: user.email,
        claimCode: user.claimCode,
        totalCredits: (user.cents / 100).toFixed(2)
      }
    });
  } catch (error) {
    console.error('[auth] Signin error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

// GET /api/auth/verify-email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'token_required' });

    const decoded = jwt.verify(token, cfg.jwtSecret);
    if (decoded.type !== 'email_verification') {
      return res.status(400).json({ error: 'invalid_token_type' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    if (user.emailVerified) {
      return res.json({ message: 'Email already verified' });
    }

    user.emailVerified = true;
    await user.save();

    res.json({ message: 'Email verified successfully!' });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'invalid_or_expired_token' });
    }
    console.error('[auth] Verify email error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

// POST /api/auth/resend-verification
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email_required' });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'email_already_verified' });
    }

    // Create new verification token
    const verificationToken = jwt.sign(
      { userId: user._id.toString(), type: 'email_verification' },
      cfg.jwtSecret,
      { expiresIn: '24h' }
    );

    const verificationLink = `${cfg.telegram.publicBaseUrl || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    // Send verification email
    await sendVerificationEmail(email, verificationLink);

    res.json({ message: 'Verification email resent.' });
  } catch (error) {
    console.error('[auth] Resend verification error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

module.exports = {
  signup,
  signin,
  verifyEmail,
  resendVerification
};