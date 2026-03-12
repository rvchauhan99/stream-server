const loginAttempts = new Map(); // { email: { count, lastAttemptAt } }
const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds

module.exports.loginRateLimiter = async function (req, res, next) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required for login" });
  }
  const record = loginAttempts.get(email);
  const now = Date.now();
  if (record) {
    if (now - record.lastAttemptAt < RATE_LIMIT_WINDOW) {
      if (record.count >= RATE_LIMIT_COUNT) {
        return res.status(429).json({
          message: "Too many login attempts. Please try again later.",
        });
      } else {
        record.count++;
        record.lastAttemptAt = now;
        loginAttempts.set(email, record);
      }
    } else {
      loginAttempts.set(email, { count: 1, lastAttemptAt: now });
    }
  } else {
    loginAttempts.set(email, { count: 1, lastAttemptAt: now });
  }

  next();
};
