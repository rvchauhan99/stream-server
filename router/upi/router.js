const express = require('express');
const router = express.Router();
const controller = require('../../controller/upi/controller');
const middleware = require('../../middleware/authMiddleware');

router.post('/', middleware.validateAdmin, controller.createUpi);
router.get('/', middleware.validateAdmin, controller.getAllUpis);
router.get('/active', middleware.validateUser, controller.getActiveUpi);
router.put('/:id/toggle', middleware.validateAdmin, controller.toggleUpi);
router.delete('/:id', middleware.validateAdmin, controller.deleteUpi);

module.exports = router;
