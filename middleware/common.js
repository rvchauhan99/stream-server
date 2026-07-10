const rateBuckets = new Map(); // key -> { count, windowStart }

function rateLimit({ keyFn, limit, windowMs, message }) {
  return (req, res, next) => {
    try {
      const key = keyFn(req);
      if (!key) return next();
      const now = Date.now();
      const record = rateBuckets.get(key);
      if (!record || now - record.windowStart >= windowMs) {
        rateBuckets.set(key, { count: 1, windowStart: now });
        return next();
      }
      if (record.count >= limit) {
        return res.status(429).json({ message: message || 'Too many requests. Please try again later.' });
      }
      record.count += 1;
      rateBuckets.set(key, record);
      next();
    } catch (e) {
      next();
    }
  };
}

const loginAttempts = new Map();
const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_WINDOW = 5 * 60 * 1000;

module.exports.loginRateLimiter = async function (req, res, next) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required for login' });
  }
  const record = loginAttempts.get(email);
  const now = Date.now();
  if (record) {
    if (now - record.lastAttemptAt < RATE_LIMIT_WINDOW) {
      if (record.count >= RATE_LIMIT_COUNT) {
        return res.status(429).json({
          message: 'Too many login attempts. Please try again later.',
        });
      }
      record.count++;
      record.lastAttemptAt = now;
      loginAttempts.set(email, record);
    } else {
      loginAttempts.set(email, { count: 1, lastAttemptAt: now });
    }
  } else {
    loginAttempts.set(email, { count: 1, lastAttemptAt: now });
  }
  next();
};

module.exports.otpRateLimiter = rateLimit({
  keyFn: (req) => {
    const email = (req.body?.email || '').toLowerCase().trim();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return email ? `otp:${email}:${ip}` : `otp:ip:${ip}`;
  },
  limit: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Too many OTP requests. Please try again in 15 minutes.',
});

module.exports.passwordResetRateLimiter = rateLimit({
  keyFn: (req) => {
    const email = (req.body?.email || '').toLowerCase().trim();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return email ? `reset:${email}:${ip}` : `reset:ip:${ip}`;
  },
  limit: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Too many password reset requests. Please try again later.',
});
