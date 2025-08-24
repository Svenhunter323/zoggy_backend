const jwt = require('jsonwebtoken');
const cfg = require('../config');

const authenticate = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, cfg.jwtSecret);
    req.user = decoded.user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = authenticate;