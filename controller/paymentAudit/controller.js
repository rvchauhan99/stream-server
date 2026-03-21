const PaymentAudit = require('../../models/paymentAudit');
const Subscription = require('../../models/subscription');
const Plan = require('../../models/plan');
const User = require('../../models/user');

exports.submitAudit = async (req, res) => {
  try {
    const { planId, upiIdUsed, utrNumber } = req.body;
    
    // basic validation
    if (!planId || !upiIdUsed || !utrNumber) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    // check if UTR already exists
    const existing = await PaymentAudit.findOne({ utrNumber });
    if (existing) {
      return res.status(400).json({ message: 'UTR Number has already been submitted.' });
    }

    const audit = new PaymentAudit({
      userId: req.user._id,
      planId,
      upiIdUsed,
      utrNumber,
      amount: plan.price,
    });
    
    await audit.save();
    res.status(201).json({ message: 'Payment submitted for verification.', audit });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllAudits = async (req, res) => {
  try {
    const { status, userId, upiId, startDate, endDate } = req.query;
    let query = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;
    if (upiId) query.upiIdUsed = upiId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const audits = await PaymentAudit.find(query)
      .populate('userId', 'name email username')
      .populate('planId', 'name price validity')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(audits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.approveAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await PaymentAudit.findById(id).populate('planId');
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    
    if (audit.status !== 'pending') {
      return res.status(400).json({ message: `Audit is already ${audit.status}` });
    }

    // 1. Mark as approved
    audit.status = 'approved';
    audit.approvedBy = req.user._id;
    audit.approvedAt = new Date();
    await audit.save();

    // 2. Create the Subscription for the User
    const validityDays = audit.planId.validityDays || (audit.planId.validity * 30);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + validityDays);

    const subscription = new Subscription({
      userId: audit.userId,
      planId: audit.planId._id,
      endDate,
      paymentDetails: {
        paymentMethod: 'upi',
        transactionId: audit.utrNumber,
        amountPaid: audit.amount
      },
      finalAmountPaid: audit.amount,
      createdBy: req.user._id
    });
    await subscription.save();

    // 3. Link the subscription to the user
    await User.findByIdAndUpdate(audit.userId, { subscriptionId: subscription._id });

    res.status(200).json({ message: 'Payment approved and subscription activated!', audit, subscription });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.rejectAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const audit = await PaymentAudit.findById(id);
    if (!audit) return res.status(404).json({ message: 'Audit not found' });

    if (audit.status !== 'pending') {
      return res.status(400).json({ message: `Audit is already ${audit.status}` });
    }

    audit.status = 'rejected';
    audit.remarks = remarks || 'Invalid UTR or payment not received.';
    audit.approvedBy = req.user._id;
    audit.approvedAt = new Date();
    await audit.save();

    res.status(200).json({ message: 'Payment rejected', audit });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Also for users to get their own audit history
exports.getMyAudits = async (req, res) => {
  try {
    const audits = await PaymentAudit.find({ userId: req.user._id })
      .populate('planId', 'name price validity')
      .sort({ createdAt: -1 });
    res.status(200).json(audits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
