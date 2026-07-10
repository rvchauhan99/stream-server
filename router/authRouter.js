const express = require('express');
const router = express.Router();
const controller = require('../controller/authController');
const middleware = require('../middleware/authMiddleware');
const { loginRateLimiter, otpRateLimiter, passwordResetRateLimiter } = require('../middleware/common');

router.post('/signup', middleware.validateSignup, controller.signup);
router.post('/send-otp', otpRateLimiter, controller.sendOtp);
router.post('/login', loginRateLimiter, controller.signIn);
router.post('/logout', controller.logOut);
router.post('/requestResetPassword', passwordResetRateLimiter, controller.requestResetPassword);
router.post('/verifyResetPassword', passwordResetRateLimiter, controller.verifyResetPassword);

module.exports = router;
