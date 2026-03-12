const express = require('express');
const router = express.Router();
const planController = require('../../controller/plan/controller');
const middleware = require('../../middleware/authMiddleware'); // Assume JWT-based middleware

router.post('/', middleware.validateAdmin, planController.createPlan);
router.get('/', planController.getAllPlans);
router.get('/:id', planController.getPlanById);
router.put('/:id', middleware.validateAdmin, planController.updatePlan);
router.delete('/:id', middleware.validateAdmin, planController.deletePlan);


module.exports = router;