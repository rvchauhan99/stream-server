const express = require('express');
const router = express.Router();

const subscriptionController = require('../../controller/subscription/controller');
const planController = require('../../controller/subscription/planController');
const promoController = require('../../controller/subscription/promoController');

const { validateUser, validateSuperAdmin, validateAdmin } = require('../../middleware/authMiddleware');

// ─── Public ───────────────────────────────────────────────────────────────────

router.get('/plans', planController.getPlans);

// ─── Authenticated: Promo Validation ──────────────────────────────────────────

router.post('/promo/validate', validateUser, promoController.validatePromo);

// ─── Authenticated: Subscriptions ─────────────────────────────────────────────

router.post('/subscribe', validateUser, subscriptionController.subscribe);
router.get('/my', validateUser, subscriptionController.getMySubscription);
router.get('/history', validateUser, subscriptionController.getMyHistory);
router.post('/cancel', validateUser, subscriptionController.cancelSubscription);

// ─── Super Admin: Plans ───────────────────────────────────────────────────────

router.get('/admin/plans', validateSuperAdmin, planController.adminGetPlans);
router.post('/admin/plans', validateSuperAdmin, planController.createPlan);
router.put('/admin/plans/:id', validateSuperAdmin, planController.updatePlan);
router.patch('/admin/plans/:id/toggle', validateSuperAdmin, planController.togglePlan);
router.delete('/admin/plans/:id', validateSuperAdmin, planController.deletePlan);

// ─── Super Admin: Promos ──────────────────────────────────────────────────────

router.get('/admin/promo', validateSuperAdmin, promoController.listPromos);
router.post('/admin/promo', validateSuperAdmin, promoController.createPromo);
router.put('/admin/promo/:id', validateSuperAdmin, promoController.updatePromo);
router.patch('/admin/promo/:id/toggle', validateSuperAdmin, promoController.togglePromo);

// ─── Admin / Super Admin: Subscriptions ───────────────────────────────────────

// Both admin & superadmin can view the list
router.get('/admin/list', validateAdmin, subscriptionController.getAllSubscriptions);

// Only superadmin can manually grant or view stats
router.post('/admin/grant', validateSuperAdmin, subscriptionController.adminGrantSubscription);
router.get('/admin/stats', validateSuperAdmin, subscriptionController.getSubscriptionStats);

module.exports = router;