const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  features: {
    type: [String],
    default: [],
  },
  price: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  validity: {
    type: Number, // in months (kept for backward compat)
    required: true,
  },
  validityDays: {
    type: Number, // derived from validity: validity * 30
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  highlight: {
    type: Boolean, // marks as "Most Popular" on the plans page
    default: false,
  },
  sortOrder: {
    type: Number, // display order on public page
    default: 0,
  },
  maxScreens: {
    type: Number, // simultaneous devices (for future use)
    default: 1,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Plan', planSchema);
