const express = require('express');
const app = express();
const middleware = require('../../middleware/authMiddleware');
const controller = require('../../controller/payout/controller');

// ─── Creator Routes ────────────────────────────────────────────────────────────

// Earnings preview (how much I can earn right now)
app.get('/earnings', middleware.validateCreator, controller.getEarnings);

// Submit a payout request
app.post('/request', middleware.validateCreator, controller.requestPayout);

// List my own payout requests
app.get('/my-requests', middleware.validateCreator, controller.getMyRequests);

// ─── Payout Rate (readable by any authenticated user, writable by superadmin) ─

app.get('/rate', middleware.validateUser, controller.getRate);
app.put('/rate', middleware.validateSuperAdmin, controller.updateRate);

// ─── Super Admin Routes ────────────────────────────────────────────────────────

// All requests with filters
app.get('/admin/requests', middleware.validateSuperAdmin, controller.getAllRequests);

// Stats dashboard for super admin
app.get('/admin/stats', middleware.validateSuperAdmin, controller.getAdminStats);

// Single request detail
app.get('/admin/requests/:id', middleware.validateSuperAdmin, controller.getRequestDetail);

// Settle (approve) a request
app.put('/admin/requests/:id/settle', middleware.validateSuperAdmin, controller.settleRequest);

// Reject a request with note
app.put('/admin/requests/:id/reject', middleware.validateSuperAdmin, controller.rejectRequest);

module.exports = app;
