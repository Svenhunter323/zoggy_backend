
const jwt = require('jsonwebtoken');
const cfg = require('../config');

// simple env-driven admin (you can swap to DB-based accounts later)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@zoggy.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

function adminLogin(req, res) {
  const { email, password } = req.body || {};
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, cfg.jwtSecret, { expiresIn: '7d' });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'invalid_credentials' });
}

function adminAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, cfg.jwtSecret);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    next();
  } catch {
    return res.status(401).json({ error: 'bad_token' });
  }
}

module.exports = { adminAuth, adminLogin };
