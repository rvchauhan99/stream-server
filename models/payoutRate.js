const mongoose = require('mongoose');

/**
 * Singleton document — only one payout rate exists at a time.
 * Super admin upserts this via PUT /payout/rate
 */
const payoutRateSchema = new mongoose.Schema(
    {
        ratePerMinute: {
            type: Number,
            required: true,
            min: 0,
            default: 0.1, // ₹ 0.10 per minute of paid-video watch time
        },
        currency: {
            type: String,
            default: 'INR',
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('PayoutRate', payoutRateSchema);
