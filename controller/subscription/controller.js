const Subscription = require('../../models/subscription');
const User = require('../../models/user');
const Plan = require('../../models/plan');
const PromoCode = require('../../models/promoCode');

// ─── User: Subscribe ──────────────────────────────────────────────────────────

/**
 * POST /subscription/subscribe
 * Body: { planId, paymentMethod, transactionId, amountPaid, promoCode? }
 * Creates a new subscription; applies promo discount if valid.
 */
exports.subscribe = async (req, res) => {
  // Client-trusted activation disabled — use UPI payment audit flow only
  return res.status(403).json({
    message:
      'Direct subscription activation is disabled. Pay via UPI and submit your UTR for admin verification.',
    usePaymentAudit: true,
  });
};

// ─── User: My Subscription ────────────────────────────────────────────────────

exports.getMySubscription = async (req, res) => {
  try {
    const now = new Date();
    // Auto-expire subscriptions past their end date and clear user.subscriptionId
    const expired = await Subscription.find({
      userId: req.user._id,
      status: 'active',
      endDate: { $lt: now },
    }).select('_id');
    if (expired.length) {
      const ids = expired.map((s) => s._id);
      await Subscription.updateMany({ _id: { $in: ids } }, { status: 'expired' });
      await User.updateOne(
        { _id: req.user._id, subscriptionId: { $in: ids } },
        { $set: { subscriptionId: null } }
      );
    }

    const subscription = await Subscription.findOne({
      userId: req.user._id,
      status: 'active',
    }).populate('planId', 'name price currency validity features highlight');

    if (!subscription) {
      return res.json({ active: false, subscription: null });
    }

    res.json({ active: true, subscription });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── User: My History ─────────────────────────────────────────────────────────

exports.getMyHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      Subscription.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('planId', 'name price currency validity'),
      Subscription.countDocuments({ userId: req.user._id }),
    ]);

    res.json({ subscriptions, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── User: Cancel ─────────────────────────────────────────────────────────────

exports.cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id, status: 'active' });
    if (!subscription) return res.status(404).json({ message: 'No active subscription found' });

    subscription.status = 'cancelled';
    subscription.updatedBy = req.user._id;
    await subscription.save();

    await User.findByIdAndUpdate(req.user._id, { subscriptionId: null });

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Admin: All Subscriptions ─────────────────────────────────────────────────

exports.getAllSubscriptions = async (req, res) => {
  try {
    const { status, planId, userId, from, to, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (planId) filter.planId = planId;
    if (userId) filter.userId = userId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'name email role')
        .populate('planId', 'name price currency validity'),
      Subscription.countDocuments(filter),
    ]);

    res.json({ subscriptions, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Super Admin: Manually Grant Subscription ─────────────────────────────────

exports.adminGrantSubscription = async (req, res) => {
  try {
    const { userId, planId, note } = req.body;
    if (!userId || !planId) return res.status(400).json({ message: 'userId and planId are required' });

    const [user, plan] = await Promise.all([
      User.findById(userId),
      Plan.findById(planId),
    ]);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    // Cancel existing
    await Subscription.updateMany(
      { userId, status: 'active' },
      { status: 'cancelled', updatedBy: req.user._id }
    );

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + plan.validity);

    const subscription = await Subscription.create({
      userId,
      planId,
      startDate: new Date(),
      endDate,
      status: 'active',
      paymentDetails: {
        paymentMethod: 'manual',
        transactionId: `ADMIN-GRANT-${Date.now()}`,
        amountPaid: 0,
      },
      discountApplied: plan.price,
      finalAmountPaid: 0,
      createdBy: req.user._id,
    });

    await User.findByIdAndUpdate(userId, { subscriptionId: subscription._id });

    res.status(201).json({ message: `Subscription granted to ${user.name || user.email}`, subscription });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Super Admin: Stats ───────────────────────────────────────────────────────

exports.getSubscriptionStats = async (req, res) => {
  try {
    const now = new Date();
    const [
      activeCount, expiredCount, cancelledCount,
      totalRevenue, revenueByPlan, monthlyRevenue, recentSubscriptions,
    ] = await Promise.all([
      Subscription.countDocuments({ status: 'active', endDate: { $gt: now } }),
      Subscription.countDocuments({ status: 'expired' }),
      Subscription.countDocuments({ status: 'cancelled' }),
      Subscription.aggregate([
        { $group: { _id: null, total: { $sum: '$finalAmountPaid' } } },
      ]),
      Subscription.aggregate([
        { $group: { _id: '$planId', count: { $sum: 1 }, revenue: { $sum: '$finalAmountPaid' } } },
        { $lookup: { from: 'plans', localField: '_id', foreignField: '_id', as: 'plan' } },
        { $unwind: { path: '$plan', preserveNullAndEmpty: true } },
        { $project: { count: 1, revenue: 1, 'plan.name': 1, 'plan.price': 1 } },
        { $sort: { revenue: -1 } },
      ]),
      Subscription.aggregate([
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$finalAmountPaid' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $limit: 12 },
      ]),
      Subscription.find({ status: 'active' })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'name email')
        .populate('planId', 'name price'),
    ]);

    res.json({
      counts: { active: activeCount, expired: expiredCount, cancelled: cancelledCount },
      totalRevenue: totalRevenue[0]?.total ?? 0,
      revenueByPlan,
      monthlyRevenue,
      recentSubscriptions,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
