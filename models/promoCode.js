const mongoose = require('mongoose');

/**
 * PromoCode — one-document-per-campaign model.
 * Super admin creates campaigns with discount config, validity window, and optional plan restriction.
 * The `usedCount` is incremented atomically when a subscription is created with this code.
 */
const promoCodeSchema = new mongoose.Schema({
    // The code users enter (stored uppercase, enforced in controller)
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
        default: '',
    },
    discountType: {
        type: String,
        enum: ['percent', 'flat'],
        required: true,
    },
    // percent: 0-100 | flat: amount in INR
    discountValue: {
        type: Number,
        required: true,
        min: 0,
    },
    // Empty = applicable to all plans; otherwise restrict to listed plan IDs
    applicablePlans: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
    }],
    validFrom: {
        type: Date,
        required: true,
    },
    validUntil: {
        type: Date,
        required: true,
    },
    // 0 = unlimited
    maxUses: {
        type: Number,
        default: 0,
    },
    usedCount: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
}, {
    timestamps: true,
});

promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ validUntil: 1, isActive: 1 });

/**
 * Instance method: validate the code for a given planId and userId.
 * Returns { valid: true, discount } or { valid: false, reason }
 */
promoCodeSchema.methods.validate = function (planId) {
    const now = new Date();

    if (!this.isActive) return { valid: false, reason: 'Promo code is inactive' };
    if (now < this.validFrom) return { valid: false, reason: 'Promo code is not yet valid' };
    if (now > this.validUntil) return { valid: false, reason: 'Promo code has expired' };
    if (this.maxUses > 0 && this.usedCount >= this.maxUses) {
        return { valid: false, reason: 'Promo code usage limit reached' };
    }
    if (this.applicablePlans.length > 0 && planId) {
        const allowed = this.applicablePlans.map(String);
        if (!allowed.includes(String(planId))) {
            return { valid: false, reason: 'Promo code is not valid for this plan' };
        }
    }

    return { valid: true };
};

/**
 * Compute the discounted price for a given original price.
 */
promoCodeSchema.methods.computeDiscount = function (originalPrice) {
    if (this.discountType === 'percent') {
        return parseFloat(((originalPrice * this.discountValue) / 100).toFixed(2));
    }
    return Math.min(this.discountValue, originalPrice);
};

module.exports = mongoose.model('PromoCode', promoCodeSchema);
