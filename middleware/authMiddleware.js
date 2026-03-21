const validator = require("validator");
const jwt = require('jsonwebtoken');
const User = require("../models/user");;

exports.validateSignup = (req, res, next) => {
  try {


    const { name, email, password, otp } = req.body;
    // Name
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res
        .status(400)
        .json({ message: "Name must be at least 2 characters" });
    }

    // Email
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    // Password
    if (!password || !validator.isStrongPassword(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long and include at least 1 lowercase, 1 uppercase, 1 number, and 1 symbol",
      });
    }

    // OTP
    console.log("OTP", otp);

    if (!otp || typeof otp !== "string" || otp.length !== 6) {
      console.log("eNTERED ");

      return res.status(400).json({ message: "A valid 6-digit OTP is required" });
    }

    next(); // all good, move to controller
  } catch (error) {
    console.error("Error validating signup:", error);
    res.status(500).json({ message: "Failed to validate signup" });
  }
};
exports.validateUser = async (req, res, next) => {
  try {

    console.log("Auth Middleware called");

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized. User does not exist.' });
    }
    // Attach user to req.user for further usage
    req.user = user;
    req.sessionId = decoded.sessionId; // save sessionId too if needed

    console.log("aurthrization passed");


    next(); // user is valid, proceed
  } catch (error) {
    console.error('Auth Middleware error:', error.message);
    res.status(401).json({ message: 'Unauthorized. Invalid or expired token.' });
  }
};

exports.validateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log("decoded user", decoded);
    if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
      return res.status(403).json({ message: 'Forbidden. Admin access required.' });
    }

    const user = await User.findById(decoded.id);
    // console.log("user", user);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized. User does not exist.' });
    }
    // Attach user to req.user for further usage
    req.user = user;
    req.sessionId = decoded.sessionId; // save sessionId too if needed
    console.log("aurthrization passed");

    next(); // user is valid, proceed
  } catch (error) {
    console.error('Auth Middleware error:', error.message);
    res.status(401).json({ message: 'Unauthorized. Invalid or expired token.' });
  }
};
exports.validateCreator = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("decoded user", decoded);
    if (decoded.role !== 'admin' && decoded.role !== 'superadmin' && decoded.role !== 'creator') {
      return res.status(403).json({ message: 'Forbidden. Creator or admin access required.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized. User does not exist.' });
    }
    // Attach user to req.user for further usage
    req.user = user;
    req.sessionId = decoded.sessionId; // save sessionId too if needed

    next(); // user is valid, proceed
  } catch (error) {
    console.error('Auth Middleware error:', error.message);
    res.status(401).json({ message: 'Unauthorized. Invalid or expired token.' });
  }
};

exports.validateSuperAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'superadmin') {
      return res.status(403).json({ message: 'Forbidden. Super admin access only.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized. User does not exist.' });
    }
    req.user = user;
    req.sessionId = decoded.sessionId;
    next();
  } catch (error) {
    console.error('validateSuperAdmin error:', error.message);
    res.status(401).json({ message: 'Unauthorized. Invalid or expired token.' });
  }
};


exports.checkUser = async (req, res, next) => {
  try {

    console.log("Auth Middleware called");

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      // return res.status(401).json({ message: 'Unauthorized. No token provided.' });
      req.user = null;
      req.sessionId = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      // return res.status(401).json({ message: 'Unauthorized. User does not exist.' });
      req.user = null;
      req.sessionId = null;
      return next();

    }
    // Attach user to req.user for further usage
    req.user = user;
    req.sessionId = decoded.sessionId; // save sessionId too if needed

    console.log("aurthrization passed");


    next(); // user is valid, proceed
  } catch (error) {
    console.error('Auth Middleware error:', error.message);
    res.status(401).json({ message: 'Unauthorized. Invalid or expired token.' });
  }
};