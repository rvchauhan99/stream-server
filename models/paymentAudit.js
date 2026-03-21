const mongoose = require('mongoose');

const paymentAuditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true,
  },
  upiIdUsed: {
    type: String, // Which UPI ID they sent money to
    required: true,
  },
  utrNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true, // Prevent reusing the same UTR
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  remarks: {
    type: String,
    default: '',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  approvedAt: {
    type: Date,
    default: null,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PaymentAudit', paymentAuditSchema);
