const User = require("../models/user");
const Otp = require("../models/otp");
const { sendEmail } = require("../utils/mailer");
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const LoginSession = require('../models/loginSession');
const validator = require('validator');
const constants = require('../utils/constants');
const crypto = require("crypto");
const LoginHistory = require("../models/loginHistory");
exports.sendOtp = async (req, res) => {
  try {
    console.log("Entered in sendOtp controller");

    const { email } = req.body;
    if (!email) return res.status(400).send({ message: "Email is required" });

    console.log("Email found");

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).send({ message: "Email already registered" });
    }

    console.log("User not exists");

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    console.log("OTP generated");

    await Otp.deleteMany({ email }); // Clear old OTPs
    await Otp.create({ email, otp, expiresAt });

    console.log("Sending OTP email");

    await sendEmail(
      email,
      "NightKing Sign-Up OTP",
      `Your one-time password for signing up on NightKing is ${otp}`
    );

    res.status(200).send({ message: "OTP sent successfully" });

  } catch (error) {
    console.log("Error while sending OTP:", error.message);
    res.status(500).send({ message: "Failed to send OTP" });
  }
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;
    const otpRecord = await Otp.findOne({ email });
    if (
      !otpRecord ||
      otpRecord.otp !== otp ||
      otpRecord.expiresAt < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "Email already registered" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const requestedRole = req.body.role === 'creator' ? 'creator' : 'viewer';
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashedPassword,
      role: requestedRole,
      isActive: true,
    });
    await user.save();
    await Otp.deleteMany({ email });
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Failed to register user" });
  }
};




exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || !validator.isEmail(email)) {
      return res.status(400).json({ message: 'Valid email and password are required' });
    }

    const user = await User.findOne({ email , isActive : true });
    if (!user) {
      return res.status(401).json({ message: 'Active  User Not found !!!' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid Password' });
    }
    const sessionId = crypto.randomBytes(16).toString('hex');

    // Create JWT Token
    const token = jwt.sign(
      { id: user._id, role: user.role, sessionId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Check Active Sessions
    const activeSessions = await LoginSession.find({ user: user._id });
    console.log("active sessions", activeSessions.length);

    console.log("constants.maxUserloginAllowed", constants.maxUserloginAllowed);
    if (process.env.NODE_ENV !== 'development' && activeSessions.length >= constants.maxUserloginAllowed) {
      return res.status(403).json({ message: 'Device limit exceeded. Please logout from another device first.' });
    }
    const ipAddress = req.headers['x-forwarded-for']?.split(',').shift()
      || req.connection?.remoteAddress
      || req.socket?.remoteAddress
      || req.connection?.socket?.remoteAddress
      || 'Unknown IP';

    const browser = req.headers['user-agent'] || 'Unknown';
    const url = req.originalUrl;

    await LoginSession.create({
      user: user._id,
      sessionId,
      ipAddress,
      browser,
      url,
      loginTime: new Date()
    });

    LoginHistory.create({
      user: user._id,
      sessionId,
      ipAddress,
      browser,
      url,
      loginTime: new Date()
    });

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      preferences: user.preferences
    };

    res.json({
      message: 'Login successful',
      token,
      user: userData
    });

  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
exports.logOut = async (req, res) => {
  try {
    console.log("Entered logout controller");
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized, token missing' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const sessionId = decoded.sessionId;

    if (!sessionId) {
      return res.status(400).json({ message: 'Invalid session' });
    }

    const result = await LoginSession.findOneAndDelete({
      user: userId,
      sessionId
    });

    if (result) {
      res.json({ message: 'Logged out successfully' });
    } else {
      res.status(404).json({ message: 'Session not found' });
    }

  } catch (error) {
    console.error('Logout error:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


exports.requestResetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

    // Remove old OTPs
    await Otp.deleteMany({ email });

    // Save new OTP
    await Otp.create({ email, otp, expiresAt });

    // Send Email
    // await sendEmail(email, otp);
    await sendEmail(
      email,
      "KnightKings Reset Pasword : OTP",
      `Your one time passwod for reseting password on knight kings is ${otp}`
    );
    res.json({ message: 'OTP sent to your email for password reset' });

  } catch (error) {
    console.error('Request Reset Password Error:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
exports.verifyResetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP and new password are required' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    if (!validator.isStrongPassword(newPassword)) {
      return res.status(400).json({
        message: 'New password must be strong (8+ characters, uppercase, lowercase, number, special char)'
      });
    }

    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord || otpRecord.otp !== otp || otpRecord.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.passwordHash = hashedPassword;
    await user.save();

    await Otp.deleteMany({ email }); // Clean OTPs

    res.json({ message: 'Password reset successful' });

  } catch (error) {
    console.error('Verify Reset Password Error:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


