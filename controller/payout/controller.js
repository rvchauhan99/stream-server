const Video = require('../../models/video');
const PayoutRate = require('../../models/payoutRate');
const PayoutRequest = require('../../models/payoutRequest');
const VideoWatchSession = require('../../models/videoWatchSession');

// ─── Anti-Abuse Constants ─────────────────────────────────────────────────────

const MIN_CHUNK_SECONDS = 5;           // ignore heartbeats shorter than this
const MAX_CHUNK_SECONDS = 60;          // single API call cannot credit more than this
const MAX_WALL_CLOCK_RATIO = 1.2;         // credited seconds ≤ wall-clock × 1.2
const SESSION_GAP_RESET_S = 30 * 60;    // 30 min gap → new session
const SINGLE_SESSION_CAP_S = 3 * 60 * 60; // 3 hours max per continuous session
const DAILY_CAP_SECONDS = 4 * 60 * 60; // 4 hours max per user per video per day

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getCurrentRate() {
    let rate = await PayoutRate.findOne().sort({ updatedAt: -1 });
    if (!rate) {
        rate = await PayoutRate.create({ ratePerMinute: 0.1 });
    }
    return rate;
}

/**
 * Compute earnings for a creator using unique VideoWatchSession data.
 * Only paid/rent videos count. Delta = uniqueWatchNow − watchTimeAtLastSettlement.
 */
async function computeEarnings(creatorId) {
    const rate = await getCurrentRate();

    const lastSettled = await PayoutRequest.findOne({
        creatorId,
        status: 'settled',
    }).sort({ settledAt: -1 });

    const lastSnapshotMap = {};
    if (lastSettled) {
        for (const item of lastSettled.videoBreakdown) {
            lastSnapshotMap[String(item.videoId)] = item.watchTimeAtRequest;
        }
    }

    const videos = await Video.find({
        creatorId,
        'monetization.type': { $in: ['paid', 'rent'] },
    }).select('_id title monetization');

    const breakdown = [];
    let totalWatchSeconds = 0;

    for (const v of videos) {
        const agg = await VideoWatchSession.aggregate([
            { $match: { videoId: v._id } },
            { $group: { _id: null, total: { $sum: '$totalCreditedSeconds' } } },
        ]);
        const uniqueWatchSeconds = agg[0]?.total ?? 0;

        const lastSnapshot = lastSnapshotMap[String(v._id)] ?? 0;
        const deltaSeconds = Math.max(0, uniqueWatchSeconds - lastSnapshot);
        const deltaMinutes = deltaSeconds / 60;

        totalWatchSeconds += deltaSeconds;

        breakdown.push({
            videoId: v._id,
            title: v.title,
            monetizationType: v.monetization?.type,
            watchMinutes: parseFloat(deltaMinutes.toFixed(2)),
            watchTimeAtRequest: uniqueWatchSeconds,
        });
    }

    const totalWatchMinutes = totalWatchSeconds / 60;
    const totalAmount = parseFloat((totalWatchMinutes * rate.ratePerMinute).toFixed(2));
    const periodStart = lastSettled?.settledAt ?? null;

    return { rate, breakdown, totalWatchMinutes: parseFloat(totalWatchMinutes.toFixed(2)), totalAmount, periodStart };
}

// ─── Creator: Get Earnings Preview ────────────────────────────────────────────

exports.getEarnings = async (req, res) => {
    try {
        const creatorId = req.user._id;
        const { rate, breakdown, totalWatchMinutes, totalAmount, periodStart } = await computeEarnings(creatorId);

        const freeVideos = await Video.find({
            creatorId,
            'monetization.type': 'free',
        }).select('_id title');

        const freeVideoIds = freeVideos.map((v) => v._id);
        const freeAgg = await VideoWatchSession.aggregate([
            { $match: { videoId: { $in: freeVideoIds } } },
            { $group: { _id: '$videoId', total: { $sum: '$totalCreditedSeconds' } } },
        ]);
        const freeWatchMap = {};
        for (const a of freeAgg) freeWatchMap[String(a._id)] = a.total;

        const notEligible = freeVideos.map((v) => ({
            videoId: v._id,
            title: v.title,
            monetizationType: 'free',
            watchMinutes: parseFloat(((freeWatchMap[String(v._id)] ?? 0) / 60).toFixed(2)),
            earnings: 0,
        }));

        res.json({
            periodStart,
            periodEnd: new Date(),
            ratePerMinute: rate.ratePerMinute,
            currency: rate.currency,
            totalWatchMinutes,
            totalAmount,
            breakdown,
            notEligible,
        });
    } catch (err) {
        console.error('getEarnings error:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// ─── Creator: Request Payout ───────────────────────────────────────────────────

exports.requestPayout = async (req, res) => {
    try {
        const creatorId = req.user._id;
        const { paymentMethod, paymentDetails } = req.body;

        if (!paymentMethod || !paymentDetails) {
            return res.status(400).json({ message: 'Payment method and details are required' });
        }

        const existingPending = await PayoutRequest.findOne({ creatorId, status: 'pending' });
        if (existingPending) {
            return res.status(400).json({ message: 'You already have a pending payout request. Please wait for it to be processed.' });
        }

        const { rate, breakdown, totalWatchMinutes, totalAmount, periodStart } = await computeEarnings(creatorId);

        if (totalAmount <= 0) {
            return res.status(400).json({ message: 'No eligible earnings to request payout for.' });
        }

        const request = await PayoutRequest.create({
            creatorId,
            periodStart: periodStart ?? req.user.createdAt,
            periodEnd: new Date(),
            totalWatchMinutes,
            ratePerMinute: rate.ratePerMinute,
            totalAmount,
            currency: rate.currency,
            videoBreakdown: breakdown,
            paymentMethod,
            paymentDetails,
            status: 'pending',
        });

        res.status(201).json({ message: 'Payout request submitted successfully', request });
    } catch (err) {
        console.error('requestPayout error:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// ─── Creator: My Requests ─────────────────────────────────────────────────────

exports.getMyRequests = async (req, res) => {
    try {
        const creatorId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
            PayoutRequest.find({ creatorId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('settledBy', 'name email'),
            PayoutRequest.countDocuments({ creatorId }),
        ]);

        res.json({ requests, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        console.error('getMyRequests error:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// ─── Super Admin: All Requests ────────────────────────────────────────────────

exports.getAllRequests = async (req, res) => {
    try {
        const { status, creatorId, from, to, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (creatorId) filter.creatorId = creatorId;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [requests, total] = await Promise.all([
            PayoutRequest.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('creatorId', 'name email role')
                .populate('settledBy', 'name email'),
            PayoutRequest.countDocuments(filter),
        ]);

        res.json({ requests, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        console.error('getAllRequests error:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// ─── Super Admin: Request Detail ──────────────────────────────────────────────

exports.getRequestDetail = async (req, res) => {
    try {
        const request = await PayoutRequest.findById(req.params.id)
            .populate('creatorId', 'name email role createdAt')
            .populate('settledBy', 'name email');
        if (!request) return res.status(404).json({ message: 'Request not found' });
        res.json(request);
    } catch (err) {
        console.error('getRequestDetail error:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// ─── Super Admin: Settle ──────────────────────────────────────────────────────

exports.settleRequest = async (req, res) => {
    try {
        const request = await PayoutRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        if (request.status !== 'pending') {
            return res.status(400).json({ message: `Request is already ${request.status}` });
        }

        request.status = 'settled';
        request.settledAt = new Date();
        request.settledBy = req.user._id;
        request.adminNote = req.body.adminNote || '';
        await request.save();

        res.json({ message: 'Payout settled successfully', request });
    } catch (err) {
        console.error('settleRequest error:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// ─── Super Admin: Reject ──────────────────────────────────────────────────────

exports.rejectRequest = async (req, res) => {
    try {
        const { adminNote } = req.body;
        if (!adminNote?.trim()) {
            return res.status(400).json({ message: 'Rejection note is required' });
        }
        const request = await PayoutRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        if (request.status !== 'pending') {
            return res.status(400).json({ message: `Request is already ${request.status}` });
        }

        request.status = 'rejected';
        request.adminNote = adminNote;
        request.settledBy = req.user._id;
        request.settledAt = new Date();
        await request.save();

        res.json({ message: 'Payout rejected', request });
    } catch (err) {
        console.error('rejectRequest error:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// ─── Payout Rate ──────────────────────────────────────────────────────────────

exports.getRate = async (req, res) => {
    try {
        const rate = await getCurrentRate();
        res.json(rate);
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.updateRate = async (req, res) => {
    try {
        const { ratePerMinute, currency } = req.body;
        if (ratePerMinute === undefined || isNaN(ratePerMinute) || ratePerMinute < 0) {
            return res.status(400).json({ message: 'Valid ratePerMinute is required' });
        }
        const rate = await PayoutRate.findOneAndUpdate(
            {},
            { ratePerMinute: parseFloat(ratePerMinute), currency: currency || 'INR', updatedBy: req.user._id },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.json({ message: 'Payout rate updated', rate });
    } catch (err) {
        console.error('updateRate error:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// ─── Super Admin: Aggregated Stats ───────────────────────────────────────────

exports.getAdminStats = async (req, res) => {
    try {
        const [
            totalPending, totalSettled, totalRejected,
            pendingAmountAgg, settledAmountAgg,
            topCreators, monthlyVolume,
        ] = await Promise.all([
            PayoutRequest.countDocuments({ status: 'pending' }),
            PayoutRequest.countDocuments({ status: 'settled' }),
            PayoutRequest.countDocuments({ status: 'rejected' }),
            PayoutRequest.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
            PayoutRequest.aggregate([{ $match: { status: 'settled' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
            PayoutRequest.aggregate([
                { $match: { status: 'settled' } },
                { $group: { _id: '$creatorId', totalEarned: { $sum: '$totalAmount' }, totalMinutes: { $sum: '$totalWatchMinutes' } } },
                { $sort: { totalEarned: -1 } }, { $limit: 10 },
                { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'creator' } },
                { $unwind: '$creator' },
                { $project: { totalEarned: 1, totalMinutes: 1, 'creator.name': 1, 'creator.email': 1 } },
            ]),
            PayoutRequest.aggregate([
                { $match: { status: 'settled' } },
                { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$settledAt' } }, amount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }, { $limit: 12 },
            ]),
        ]);

        res.json({
            counts: { pending: totalPending, settled: totalSettled, rejected: totalRejected },
            amounts: { pending: pendingAmountAgg[0]?.total ?? 0, settled: settledAmountAgg[0]?.total ?? 0 },
            topCreators,
            monthlyVolume,
        });
    } catch (err) {
        console.error('getAdminStats error:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// ─── Video: Track Watch Time (with dedup + anti-abuse) ───────────────────────
/**
 * POST /payout/video/:id/watchtime
 * Body: { seconds: number }
 * Requires: authenticated user
 *
 * Rules enforced (in order):
 *  1. Minimum chunk guard:   < 5s → ignored (tab-switch noise)
 *  2. Hard chunk cap:        > 60s → capped at 60s per call
 *  3. Wall-clock rate limit: chunk > elapsed×1.2 → capped (no fast-forward farming)
 *  4. Session cap reset:     gap > 30 min → new session; session ≤ 3 hours
 *  5. Daily cap:             ≤ 4 hours per user per video per day
 *  6. Duration cap:          total credited ≤ video duration (can't over-earn)
 *
 * After crediting, Video.stats.watchTime = SUM(unique user sessions) — ensures
 * raw view counts can never be inflated by repeat watches from the same user.
 */
exports.trackWatchTime = async (req, res) => {
    try {
        const videoId = req.params.id;
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: 'Authentication required to track watch time' });
        }

        let { seconds } = req.body;
        seconds = parseFloat(seconds);

        // Rule 1 — minimum chunk
        if (!seconds || isNaN(seconds) || seconds < MIN_CHUNK_SECONDS) {
            return res.json({ message: 'Chunk too short — not recorded', credited: 0 });
        }

        // Rule 2 — hard cap per call
        seconds = Math.min(seconds, MAX_CHUNK_SECONDS);

        const video = await Video.findById(videoId).select('duration stats');
        if (!video) return res.status(404).json({ message: 'Video not found' });

        const videoDuration = video.duration ?? 0;

        let session = await VideoWatchSession.findOne({ videoId, userId });
        if (!session) {
            session = new VideoWatchSession({ videoId, userId });
        }

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

        // Rule 3 — wall-clock rate-limit
        if (session.lastCreditedAt) {
            const wallClockElapsed = (now - session.lastCreditedAt) / 1000;
            const maxAllowable = wallClockElapsed * MAX_WALL_CLOCK_RATIO;
            if (seconds > maxAllowable) {
                seconds = Math.max(0, Math.min(seconds, maxAllowable));
                if (seconds < MIN_CHUNK_SECONDS) {
                    session.lastCreditedAt = now;
                    await session.save();
                    return res.json({ message: 'Rate limit exceeded — credit skipped', credited: 0 });
                }
            }
        }

        // Rule 4 — session reset + session cap
        const gapSecs = session.lastCreditedAt
            ? (now - session.lastCreditedAt) / 1000
            : Infinity;

        if (gapSecs > SESSION_GAP_RESET_S) {
            session.currentSessionSeconds = 0;
            session.currentSessionStartedAt = now;
        }

        const sessionRemaining = SINGLE_SESSION_CAP_S - session.currentSessionSeconds;
        seconds = Math.min(seconds, Math.max(0, sessionRemaining));

        if (seconds < MIN_CHUNK_SECONDS) {
            return res.json({ message: 'Session cap reached — resume after a 30 min break', credited: 0 });
        }

        // Rule 5 — daily cap
        if (session.todayDate !== todayStr) {
            session.todayCreditedSeconds = 0;
            session.todayDate = todayStr;
        }
        const dailyRemaining = DAILY_CAP_SECONDS - session.todayCreditedSeconds;
        seconds = Math.min(seconds, Math.max(0, dailyRemaining));

        if (seconds < MIN_CHUNK_SECONDS) {
            return res.json({ message: 'Daily cap reached for this video — come back tomorrow', credited: 0 });
        }

        // Rule 6 — video duration cap
        if (videoDuration > 0) {
            const totalRemaining = videoDuration - session.totalCreditedSeconds;
            seconds = Math.min(seconds, Math.max(0, totalRemaining));
            if (seconds < MIN_CHUNK_SECONDS) {
                return res.json({ message: 'Full video already credited for this user', credited: 0 });
            }
        }

        seconds = Math.floor(seconds);

        // Apply credit
        session.totalCreditedSeconds += seconds;
        session.todayCreditedSeconds += seconds;
        session.currentSessionSeconds += seconds;
        session.lastCreditedAt = now;
        await session.save();

        // Recompute Video.stats.watchTime = SUM of all unique user sessions
        const agg = await VideoWatchSession.aggregate([
            { $match: { videoId: video._id } },
            { $group: { _id: null, total: { $sum: '$totalCreditedSeconds' } } },
        ]);
        const uniqueTotal = agg[0]?.total ?? 0;
        await Video.findByIdAndUpdate(videoId, { $set: { 'stats.watchTime': uniqueTotal } });

        res.json({ message: 'Watch time recorded', credited: seconds, totalUniqueSeconds: uniqueTotal });
    } catch (err) {
        console.error('trackWatchTime error:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};
