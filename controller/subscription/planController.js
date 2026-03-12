const Plan = require('../../models/plan');

// ─── Public ───────────────────────────────────────────────────────────────────

/** GET /subscription/plans — public list of active plans */
exports.getPlans = async (req, res) => {
    try {
        const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1, price: 1 });
        res.json(plans);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ─── Super Admin ──────────────────────────────────────────────────────────────

/** GET /subscription/admin/plans — all plans including inactive */
exports.adminGetPlans = async (req, res) => {
    try {
        const plans = await Plan.find().sort({ sortOrder: 1, price: 1 }).populate('createdBy', 'name email');
        res.json(plans);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** POST /subscription/admin/plans */
exports.createPlan = async (req, res) => {
    try {
        const { name, description, features, price, currency, validity, highlight, sortOrder, maxScreens } = req.body;
        if (!name || price === undefined || !validity) {
            return res.status(400).json({ message: 'name, price, and validity are required' });
        }
        const plan = await Plan.create({
            name: name.trim(),
            description,
            features: features || [],
            price: parseFloat(price),
            currency: currency || 'INR',
            validity: parseInt(validity),
            validityDays: parseInt(validity) * 30,
            highlight: Boolean(highlight),
            sortOrder: parseInt(sortOrder) || 0,
            maxScreens: parseInt(maxScreens) || 1,
            isActive: true,
            createdBy: req.user._id,
        });
        res.status(201).json({ message: 'Plan created', plan });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** PUT /subscription/admin/plans/:id */
exports.updatePlan = async (req, res) => {
    try {
        const { name, description, features, price, currency, validity, highlight, sortOrder, maxScreens, isActive } = req.body;
        const update = {};
        if (name !== undefined) update.name = name.trim();
        if (description !== undefined) update.description = description;
        if (features !== undefined) update.features = features;
        if (price !== undefined) update.price = parseFloat(price);
        if (currency !== undefined) update.currency = currency;
        if (validity !== undefined) { update.validity = parseInt(validity); update.validityDays = parseInt(validity) * 30; }
        if (highlight !== undefined) update.highlight = Boolean(highlight);
        if (sortOrder !== undefined) update.sortOrder = parseInt(sortOrder);
        if (maxScreens !== undefined) update.maxScreens = parseInt(maxScreens);
        if (isActive !== undefined) update.isActive = Boolean(isActive);
        update.updatedBy = req.user._id;

        const plan = await Plan.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        res.json({ message: 'Plan updated', plan });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** PATCH /subscription/admin/plans/:id/toggle */
exports.togglePlan = async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        plan.isActive = !plan.isActive;
        plan.updatedBy = req.user._id;
        await plan.save();
        res.json({ message: `Plan ${plan.isActive ? 'activated' : 'deactivated'}`, plan });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/** DELETE /subscription/admin/plans/:id */
exports.deletePlan = async (req, res) => {
    try {
        const Subscription = require('../../models/subscription');
        const inUse = await Subscription.exists({ planId: req.params.id, status: 'active' });
        if (inUse) {
            return res.status(400).json({ message: 'Cannot delete a plan that has active subscribers. Deactivate it instead.' });
        }
        await Plan.findByIdAndDelete(req.params.id);
        res.json({ message: 'Plan deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
