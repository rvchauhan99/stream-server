const mongoose = require('mongoose');

const videoBreakdownSchema = new mongoose.Schema(
    {
        videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
        title: String,
        monetizationType: { type: String, enum: ['paid', 'rent'] },
        watchMinutes: { type: Number, default: 0 },
        watchTimeAtRequest: { type: Number, default: 0 }, // cumulative watchTime (seconds) at request time
    },
    { _id: false }
);

const payoutRequestSchema = new mongoose.Schema(
    {
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        // Period this request covers
        periodStart: { type: Date, required: true }, // = last settlement date (or account creation if first)
        periodEnd: { type: Date, required: true },   // = moment of request

        // Earnings snapshot
        totalWatchMinutes: { type: Number, default: 0 },
        ratePerMinute: { type: Number, required: true },
        totalAmount: { type: Number, default: 0 },
        currency: { type: String, default: 'INR' },

        // Per-video audit trail (paid/rent videos only)
        videoBreakdown: [videoBreakdownSchema],

        // Payment details provided by creator
        paymentMethod: { type: String, enum: ['bank', 'upi'], required: true },
        paymentDetails: { type: String }, // bank account / UPI ID

        // Lifecycle
        status: {
            type: String,
            enum: ['pending', 'settled', 'rejected'],
            default: 'pending',
            index: true,
        },
        adminNote: { type: String, default: '' },
        settledAt: { type: Date },
        settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('PayoutRequest', payoutRequestSchema);
