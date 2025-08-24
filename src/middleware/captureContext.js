module.exports = function captureContext(req, res, next) {
    req.ctx = {
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
      ua: req.headers['user-agent'] || '',
      deviceId: req.headers['x-device-id'] || ''
    };
    next();
  };
  