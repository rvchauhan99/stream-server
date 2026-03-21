const mongoose = require('mongoose');

/**
 * First authenticated user to watch a paid/rent video from a deviceFingerprint
 * owns payout-eligible watch time for (videoId, device). Other users on the same device get no credit.
 */
const schema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
      index: true,
    },
    deviceFingerprint: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

schema.index({ videoId: 1, deviceFingerprint: 1 }, { unique: true });

module.exports = mongoose.model('VideoWatchDeviceBinding', schema);
