const express = require('express');
const auth = require('../../middleware/authMiddleware');
const reportController = require('../../controller/report/controller');

const router = express.Router();

// Optional auth: checkUser attaches req.user when token is present.
router.post('/videos/:videoId', auth.checkUser, reportController.createVideoReport);

module.exports = router;

