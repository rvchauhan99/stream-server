const mongoose = require('mongoose');

const monetizationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['free', 'paid', 'rent'],
    default: 'free'
  },
  currency: {
    type: String,
    default: 'INR'
  },
  price: {
    type: Number,
    default: 0
  },
  adConfig: [{
    type: Date
  }]
}, { _id: false });

const statsSchema = new mongoose.Schema({
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  disLikes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  watchTime: { type: Number, default: 0 } // In seconds or minutes as you decide
}, { _id: false });

const videoSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['thirdparty', 'uploaded'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
    // Optionally you can validate against GEN CODES
  },
  tags: [{
    type: String,
    trim: true
  }],
  visibility: {
    type: String,
    enum: ['public', 'private', 'scheduled'],
    default: 'public'
  },
  monetization: {
    type: monetizationSchema,
    default: () => ({})
  },
  drmEnabled: {
    type: Boolean,
    default: true
  },
  geoRestrictions: [{
    type: String,
    trim: true
  }],
  filePath: {
    type: String,
    trim: true
  },
  thumbnailPath: {
    type: String,
    trim: true
  },
  previewPath: {
    type: String,
    trim: true,
    default: ''
  },
  duration: {
    type: Number, // Store duration in seconds
    default: 0
  },
  stats: {
    type: statsSchema,
    default: () => ({})
  },
  // Payout rate (₹/min) snapshotted at upload time for accurate future payout calculations
  payoutRateSnapshot: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // Automatically handles createdAt and updatedAt
});

module.exports = mongoose.model('Video', videoSchema);
