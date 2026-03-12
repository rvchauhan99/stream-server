const Video = require('../models/video');
const Subscription = require('../models/subscription');

/**
 * requireVideoAccess — middleware to enforce video access rules.
 *
 * Access Matrix:
 *  monetization.type === 'free'         → allow everyone (no auth needed)
 *  Not authenticated                    → 401
 *  role admin / superadmin              → allow
 *  role creator + owns the video        → allow
 *  active Subscription exists           → allow
 *  Otherwise                            → 403 with upgrade info
 */
exports.requireVideoAccess = async (req, res, next) => {
    try {
        // Video ID can come from params.id or params.videoId
        const videoId = req.params.id || req.params.videoId;
        if (!videoId) return next(); // No specific video → pass through

        const video = await Video.findOne({
            $or: [
                { _id: videoId.match(/^[0-9a-fA-F]{24}$/) ? videoId : null },
                { videoId },
            ],
        }).select('monetization creatorId');

        // Video not found → let the controller handle the 404
        if (!video) return next();

        const monetizationType = video.monetization?.type ?? 'free';

        // Rule 1: Free videos are always accessible
        if (monetizationType === 'free') return next();

        // Rule 2: Paid/rent requires authentication
        if (!req.user) {
            return res.status(401).json({
                message: 'Please log in to watch this video',
                requiresAuth: true,
            });
        }

        const { role, _id: userId } = req.user;

        // Rule 3: Admins always have access
        if (role === 'admin' || role === 'superadmin') return next();

        // Rule 4: Creator can access their own paid/rent videos
        if (role === 'creator' && String(video.creatorId) === String(userId)) {
            return next();
        }

        // Rule 5: Active subscription check
        const now = new Date();
        const sub = await Subscription.findOne({
            userId,
            status: 'active',
            endDate: { $gt: now },
        });

        if (sub) return next();

        // No access
        return res.status(403).json({
            message: 'This video requires an active subscription',
            requiresSubscription: true,
            monetizationType,
        });
    } catch (err) {
        console.error('videoAccess middleware error:', err.message);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Lightweight helper to check if the current user can access a video.
 * Returns { canAccess: Boolean, reason: String }
 * Used by the video detail controller to include access status in the response.
 */
exports.checkVideoAccess = async (userId, userRole, video) => {
    const monetizationType = video.monetization?.type ?? 'free';

    if (monetizationType === 'free') return { canAccess: true };
    if (!userId) return { canAccess: false, reason: 'unauthenticated' };
    if (userRole === 'admin' || userRole === 'superadmin') return { canAccess: true };
    if (userRole === 'creator' && String(video.creatorId) === String(userId)) {
        return { canAccess: true };
    }

    const now = new Date();
    const sub = await Subscription.findOne({
        userId,
        status: 'active',
        endDate: { $gt: now },
    });

    if (sub) return { canAccess: true };
    return { canAccess: false, reason: 'subscription_required' };
};
