const jwt = require('jsonwebtoken');
const cfg = require('../config');
const User = require('../models/User');

async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'no_token' });
  try {
    const payload = jwt.verify(token, cfg.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user || user.authVersion !== payload.v) return res.status(401).json({ error: 'bad_token' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'bad_token' });
  }
}

function sign(user) {
  return jwt.sign({ sub: user._id.toString(), v: user.authVersion }, cfg.jwtSecret, { expiresIn: '30d' });
}

module.exports = { auth, sign };
