const express = require('express');
const router = express.Router();
const controller = require('../../controller/paymentAudit/controller');
const middleware = require('../../middleware/authMiddleware');

router.post('/submit', middleware.validateUser, controller.submitAudit);
router.get('/my-audits', middleware.validateUser, controller.getMyAudits);

router.get('/', middleware.validateAdmin, controller.getAllAudits);
router.post('/:id/approve', middleware.validateAdmin, controller.approveAudit);
router.post('/:id/reject', middleware.validateAdmin, controller.rejectAudit);

module.exports = router;
