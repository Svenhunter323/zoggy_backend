const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { newReferralCode, newClaimCode } = require('../utils/ids');
const { addToList } = require('../services/mailchimp');
const { sign, auth } = require('../middleware/auth');
const cfg = require('../config');

// Create email transporter
const createTransporter = () => {
  // Use Mailtrap for development, SMTP for production
  console.log('mode: ', cfg.env);
  if (cfg.env === 'development' && cfg.mailtrap.host) {
    return nodemailer.createTransport({
      host: cfg.mailtrap.host,
      port: cfg.mailtrap.port,
      secure: cfg.mailtrap.secure,
      auth: {
        user: cfg.mailtrap.username,
        pass: cfg.mailtrap.password
      }
    });
  } else if (cfg.env === 'production' && cfg.smtp.host) {
    return nodemailer.createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port,
      secure: cfg.smtp.secure,
      auth: {
        user: cfg.smtp.user,
        pass: cfg.smtp.pass
      }
    });
  }
  return null;
};

// Helper function to validate email format
const isValidEmail = (email) => {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};

// Send verification email
const sendVerificationEmail = async (email, verificationLink) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[auth] No email transporter configured');
    return;
  }

  const mailOptions = {
    from: cfg.email.from,
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
      const { email, ref } = req.body || {};
      if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'invalid_email_format' });
  
      // duplicate email check
      const existing = await User.findOne({ email });
      if (existing) {
        const token = sign(existing);
        return res.json({ token, referralCode: existing.referralCode });
      }
  
      // IP/device throttling
      const ip = req.ctx.ip;
      const count = await ipSignupCount(ip);
      if (count >= cfg.antifraud.maxPerIpPerDay) {
        return res.status(429).json({ error: 'too_many_signups_from_ip' });
      }
  
      // Generate referral and claim codes
      const referralCode = newReferralCode();
      const claimCode = newClaimCode();
  
      // Handle referral code logic
      let referredBy = (ref || '').trim();
      if (referredBy) {
        const referredUser = await User.findOne({ referralCode: referredBy });
        if (!referredUser) {
          return res.status(400).json({ error: 'invalid_referral_code' });
        }
      }
  
      // Prevent self-referrals
      if (!cfg.antifraud.allowSelfRef && referredBy === referralCode) {
        referredBy = ''; // prevent self-ref
      }
  
      // Create new user
      const user = await User.create({
        email,
        referralCode,
        claimCode,
        referredBy,
        signupIp: req.ctx.ip,
        signupUa: req.ctx.ua,
        deviceId: req.ctx.deviceId,
      });
  
      // Increment inviter's referral count
      if (referredBy) {
        await User.updateOne({ referralCode: referredBy }, { $inc: { referralCount: 1 } });
      }
  
      // Create verification token
      const verificationToken = jwt.sign(
        { userId: user._id.toString(), type: 'email_verification' },
        cfg.jwtSecret,
        { expiresIn: '24h' }
      );
  
      const verificationLink = `${cfg.publicBaseUrl || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
  
      // Send verification email
      await sendVerificationEmail(email, verificationLink);
  
      // Add user to Mailchimp
      addToList(email).catch((e) => console.error('Error adding to Mailchimp:', e));
  
      // Generate JWT token
      const token = sign(user);
  
      // Respond with the token and referral code
      res.json({ token, referralCode });
    } catch (e) {
      console.error('Error in /waitlist:', e);
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
        referralCode: user.referralCode,
        balance: user.credits+(user.cents/100),
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

    const verificationLink = `${cfg.publicBaseUrl || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

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