const validator = require("validator");
const jwt = require('jsonwebtoken');
const User = require("../models/user");
const LoginSession = require("../models/loginSession");

async function resolveAuth(req, { requireAuth = true } = {}) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    if (requireAuth) {
      const err = new Error('Unauthorized. No token provided.');
      err.status = 401;
      throw err;
    }
    return { user: null, sessionId: null };
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    const err = new Error('Unauthorized. Invalid or expired token.');
    err.status = 401;
    throw err;
  }

  const user = await User.findById(decoded.id);
  if (!user || user.isActive === false) {
    const err = new Error('Unauthorized. User does not exist or is blocked.');
    err.status = 401;
    throw err;
  }

  if (!decoded.sessionId) {
    const err = new Error('Unauthorized. Invalid session.');
    err.status = 401;
    throw err;
  }

  const session = await LoginSession.findOne({
    user: user._id,
    sessionId: decoded.sessionId,
  });
  if (!session) {
    const err = new Error('Unauthorized. Session expired or logged out.');
    err.status = 401;
    throw err;
  }

  return { user, sessionId: decoded.sessionId };
}

exports.validateSignup = (req, res, next) => {
  try {
    const { name, email, password, otp } = req.body;
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters" });
    }
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }
    if (!password || !validator.isStrongPassword(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long and include at least 1 lowercase, 1 uppercase, 1 number, and 1 symbol",
      });
    }
    if (!otp || typeof otp !== "string" || otp.length !== 6) {
      return res.status(400).json({ message: "A valid 6-digit OTP is required" });
    }
    next();
  } catch (error) {
    console.error("Error validating signup:", error);
    res.status(500).json({ message: "Failed to validate signup" });
  }
};

exports.validateUser = async (req, res, next) => {
  try {
    const { user, sessionId } = await resolveAuth(req, { requireAuth: true });
    req.user = user;
    req.sessionId = sessionId;
    next();
  } catch (error) {
    res.status(error.status || 401).json({ message: error.message });
  }
};

exports.validateAdmin = async (req, res, next) => {
  try {
    const { user, sessionId } = await resolveAuth(req, { requireAuth: true });
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Forbidden. Admin access required.' });
    }
    req.user = user;
    req.sessionId = sessionId;
    next();
  } catch (error) {
    res.status(error.status || 401).json({ message: error.message });
  }
};

exports.validateCreator = async (req, res, next) => {
  try {
    const { user, sessionId } = await resolveAuth(req, { requireAuth: true });
    if (user.role !== 'admin' && user.role !== 'superadmin' && user.role !== 'creator') {
      return res.status(403).json({ message: 'Forbidden. Creator or admin access required.' });
    }
    req.user = user;
    req.sessionId = sessionId;
    next();
  } catch (error) {
    res.status(error.status || 401).json({ message: error.message });
  }
};

exports.validateSuperAdmin = async (req, res, next) => {
  try {
    const { user, sessionId } = await resolveAuth(req, { requireAuth: true });
    if (user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Forbidden. Super admin access only.' });
    }
    req.user = user;
    req.sessionId = sessionId;
    next();
  } catch (error) {
    res.status(error.status || 401).json({ message: error.message });
  }
};

exports.checkUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      req.user = null;
      req.sessionId = null;
      return next();
    }
    const { user, sessionId } = await resolveAuth(req, { requireAuth: true });
    req.user = user;
    req.sessionId = sessionId;
    next();
  } catch {
    // Optional auth: treat invalid/expired session as anonymous
    req.user = null;
    req.sessionId = null;
    next();
  }
};
