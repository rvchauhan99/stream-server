const { validateCreatePlan, validateUpdatePlan } = require('../../middleware/plan');
const Plan = require('../../models/plan');
exports.createPlan = async (req, res) => {
    const { isValid, errors } = validateCreatePlan(req.body);
    if (!isValid) return res.status(400).json({ errors });

    try {
        const { name, description, features, price, validity } = req.body;

        const newPlan = new Plan({
            name,
            description,
            features,
            price,
            validity,
            createdBy: req.user._id,
        });

        await newPlan.save();
        res.status(201).json(newPlan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
// Update Plan
exports.updatePlan = async (req, res) => {
    const { isValid, errors } = validateUpdatePlan(req.params.id, req.body);
    if (!isValid) return res.status(400).json({ errors });

    try {
        const updates = { ...req.body, updatedBy: req.user._id };
        const updatedPlan = await Plan.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!updatedPlan) return res.status(404).json({ error: 'Plan not found' });
        res.json(updatedPlan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// Get All Plans
exports.getAllPlans = async (req, res) => {
    try {
        const plans = await Plan.find().populate('createdBy updatedBy', 'name email');
        res.json(plans);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get Single Plan
exports.getPlanById = async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id).populate('createdBy updatedBy', 'name email');
        if (!plan) return res.status(404).json({ error: 'Plan not found' });
        res.json(plan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete Plan
exports.deletePlan = async (req, res) => {
    try {
        const deleted = await Plan.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Plan not found' });
        res.json({ message: 'Plan deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};