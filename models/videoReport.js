const mongoose = require('mongoose');

const videoReportSchema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reporterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reporterIp: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        'spam',
        'inappropriate',
        'copyright',
        'harassment',
        'misleading',
        'other',
      ],
    },
    details: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

// Prevent exact duplicates for the same reporter + video + reason
videoReportSchema.index({ videoId: 1, reporterUserId: 1, reporterIp: 1, reason: 1 }, { unique: false });

module.exports = mongoose.model('VideoReport', videoReportSchema);

