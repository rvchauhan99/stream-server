const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
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
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active',
  },
  paymentDetails: {
    paymentMethod: {
      type: String,
      enum: ['card', 'paypal', 'wallet', 'upi', 'bank_transfer', 'manual'],
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
    },
    amountPaid: {
      type: Number,
      required: true,
    }
  },
  // Promo code applied at subscribe time
  promoCodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromoCode',
    default: null,
  },
  promoCode: {
    type: String,
    default: null,
  },
  discountApplied: {
    type: Number,
    default: 0,
  },
  finalAmountPaid: {
    type: Number,
    default: 0,
  },
  autoRenew: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
