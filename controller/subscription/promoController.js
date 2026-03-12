const PromoCode = require('../../models/promoCode');
const Plan = require('../../models/plan');

// ─── Public / Authenticated ───────────────────────────────────────────────────

/**
 * POST /subscription/promo/validate
 * Body: { code, planId }
 * Validates a promo code and returns the discount without burning a use.
 */
exports.validatePromo = async (req, res) => {
    try {
        const { code, planId } = req.body;
        if (!code) return res.status(400).json({ message: 'Promo code is required' });

        const promo = await PromoCode.findOne({ code: code.toUpperCase().trim() });
        if (!promo) return res.status(404).json({ message: 'Invalid promo code' });

        const { valid, reason } = promo.validate(planId);
        if (!valid) return res.status(400).json({ message: reason });

        // Fetch plan price to compute discount amount
        let discountAmount = 0;
        let originalPrice = null;
        let finalPrice = null;
        if (planId) {
            const plan = await Plan.findById(planId);
            if (plan) {
                originalPrice = plan.price;
                discountAmount = promo.computeDiscount(plan.price);
                finalPrice = Math.max(0, plan.price - discountAmount);
            }
        }

        res.json({
            valid: true,
            code: promo.code,
            discountType: promo.discountType,
            discountValue: promo.discountValue,
            discountAmount,
            originalPrice,
            finalPrice,
            description: promo.description,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ─── Super Admin ──────────────────────────────────────────────────────────────

/** GET /subscription/admin/promo — paginated list of all promo codes */
exports.listPromos = async (req, res) => {
    try {
        const { page = 1, limit = 20, active } = req.query;
        const filter = {};
        if (active !== undefined) filter.isActive = active === 'true';

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [promos, total] = await Promise.all([
            PromoCode.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('applicablePlans', 'name price')
                .populate('createdBy', 'name email'),
            PromoCode.countDocuments(filter),
        ]);

        res.json({ promos, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** POST /subscription/admin/promo */
exports.createPromo = async (req, res) => {
    try {
        const { code, description, discountType, discountValue, applicablePlans, validFrom, validUntil, maxUses, isActive } = req.body;

        if (!code || !discountType || discountValue === undefined || !validFrom || !validUntil) {
            return res.status(400).json({ message: 'code, discountType, discountValue, validFrom, validUntil are required' });
        }
        if (!['percent', 'flat'].includes(discountType)) {
            return res.status(400).json({ message: 'discountType must be percent or flat' });
        }
        if (discountType === 'percent' && (discountValue < 0 || discountValue > 100)) {
            return res.status(400).json({ message: 'Percent discount must be 0-100' });
        }
        if (new Date(validFrom) >= new Date(validUntil)) {
            return res.status(400).json({ message: 'validUntil must be after validFrom' });
        }

        const promo = await PromoCode.create({
            code: code.toUpperCase().trim(),
            description: description || '',
            discountType,
            discountValue: parseFloat(discountValue),
            applicablePlans: applicablePlans || [],
            validFrom: new Date(validFrom),
            validUntil: new Date(validUntil),
            maxUses: parseInt(maxUses) || 0,
            isActive: isActive !== false,
            createdBy: req.user._id,
        });

        res.status(201).json({ message: 'Promo code created', promo });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'Promo code already exists' });
        res.status(500).json({ message: err.message });
    }
};

/** PUT /subscription/admin/promo/:id */
exports.updatePromo = async (req, res) => {
    try {
        const { description, discountType, discountValue, applicablePlans, validFrom, validUntil, maxUses, isActive } = req.body;
        const update = { updatedBy: req.user._id };
        if (description !== undefined) update.description = description;
        if (discountType) update.discountType = discountType;
        if (discountValue !== undefined) update.discountValue = parseFloat(discountValue);
        if (applicablePlans) update.applicablePlans = applicablePlans;
        if (validFrom) update.validFrom = new Date(validFrom);
        if (validUntil) update.validUntil = new Date(validUntil);
        if (maxUses !== undefined) update.maxUses = parseInt(maxUses);
        if (isActive !== undefined) update.isActive = Boolean(isActive);

        const promo = await PromoCode.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!promo) return res.status(404).json({ message: 'Promo code not found' });
        res.json({ message: 'Promo code updated', promo });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** PATCH /subscription/admin/promo/:id/toggle */
exports.togglePromo = async (req, res) => {
    try {
        const promo = await PromoCode.findById(req.params.id);
        if (!promo) return res.status(404).json({ message: 'Promo code not found' });
        promo.isActive = !promo.isActive;
        await promo.save();
        res.json({ message: `Promo ${promo.isActive ? 'activated' : 'deactivated'}`, promo });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
