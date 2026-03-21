const express = require('express');
const router = express.Router();
const controller = require('../../controller/supportTicket/controller');
const { validateUser, validateAdmin } = require('../../middleware/authMiddleware');

router.post('/', validateUser, controller.createTicket);
router.get('/my-tickets', validateUser, controller.getMyTickets);
router.get('/all', validateAdmin, controller.getAllTickets);

module.exports = router;
