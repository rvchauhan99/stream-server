const Video = require('../../models/video');
const PayoutRate = require('../../models/payoutRate');
const PayoutRequest = require('../../models/payoutRequest');
const VideoWatchSession = require('../../models/videoWatchSession');
const VideoWatchDeviceBinding = require('../../models/videoWatchDeviceBinding');
const User = require('../../models/user');

// ─── Anti-Abuse Constants ─────────────────────────────────────────────────────

const MIN_CHUNK_SECONDS = 5;           // ignore heartbeats shorter than this
const MAX_CHUNK_SECONDS = 60;          // single API call cannot credit more than this
const MAX_WALL_CLOCK_RATIO = 1.2;         // credited seconds ≤ wall-clock × 1.2
const SESSION_GAP_RESET_S = 30 * 60;    // 30 min gap → new session
const SINGLE_SESSION_CAP_S = 3 * 60 * 60; // 3 hours max per continuous session
const DAILY_CAP_SECONDS = 4 * 60 * 60; // 4 hours max per user per video per day
const SETTLE_AMOUNT_TOLERANCE = 0.02; // max drift vs live recompute (currency units)

// ─── Payout-eligible seconds per user (max single session, capped by duration) ─

function userEligibleSeconds(session, videoDuration) {
    const best = Math.max(
        session.maxCompletedSessionSeconds || 0,
        session.currentSessionSeconds || 0
    );
    if (videoDuration > 0) return Math.min(videoDuration, best);
    return best;
}

async function sumEligibleWatchSecondsForVideo(videoId, videoDuration) {
    const sessions = await VideoWatchSession.find({ videoId }).lean();
    let sum = 0;
    for (const s of sessions) {
        sum += userEligibleSeconds(s, videoDuration);
    }
    return sum;
}

async function recomputeVideoWatchTimeStats(videoId, videoDuration) {
    const total = await sumEligibleWatchSecondsForVideo(videoId, videoDuration);
    await Video.findByIdAndUpdate(videoId, { $set: { 'stats.watchTime': total } });
    return total;
}

function mergeSnapshotMaps(settledReq, pendingReq) {
    const map = {};
    if (settledReq) {
        for (const item of settledReq.videoBreakdown || []) {
            map[String(item.videoId)] = item.watchTimeAtRequest;
        }
    }
    if (pendingReq) {
        for (const item of pendingReq.videoBreakdown || []) {
            const k = String(item.videoId);
            map[k] = Math.max(map[k] ?? 0, item.watchTimeAtRequest);
        }
    }
    return map;
}

function effectivePeriodStart(lastSettled, pendingReq) {
    if (lastSettled?.settledAt) return lastSettled.settledAt;
    if (pendingReq?.createdAt) return pendingReq.createdAt;
    return null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getCurrentRate() {
    let rate = await PayoutRate.findOne().sort({ updatedAt: -1 });
    if (!rate) {
        rate = await PayoutRate.create({ ratePerMinute: 0.1 });
    }
    return rate;
}

/**
 * Compute earnings for a creator using VideoWatchSession payout-eligible seconds (max single session per user).
 * Only paid/rent videos count. Delta = eligibleNow − max(lastSettled, pending) snapshot per video.
 */
async function computeEarnings(creatorId) {
    const rate = await getCurrentRate();

    const [lastSettled, pendingReq] = await Promise.all([
        PayoutRequest.findOne({ creatorId, status: 'settled' }).sort({ settledAt: -1 }),
        PayoutRequest.findOne({ creatorId, status: 'pending' }),
    ]);

    const lastSnapshotMap = mergeSnapshotMaps(lastSettled, pendingReq);

    const videos = await Video.find({
        creatorId,
        'monetization.type': { $in: ['paid', 'rent'] },
    }).select('_id title monetization duration');

    const breakdown = [];
    let totalWatchSeconds = 0;

    for (const v of videos) {
        const duration = v.duration ?? 0;
        const uniqueWatchSeconds = await sumEligibleWatchSecondsForVideo(v._id, duration);

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
    const periodStart = effectivePeriodStart(lastSettled, pendingReq);

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
        }).select('_id title duration');

        const notEligible = [];
        for (const v of freeVideos) {
            const secs = await sumEligibleWatchSecondsForVideo(v._id, v.duration ?? 0);
            notEligible.push({
                videoId: v._id,
                title: v.title,
                monetizationType: 'free',
                watchMinutes: parseFloat((secs / 60).toFixed(2)),
                earnings: 0,
            });
        }

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
        const { status, creatorId, creatorEmail, from, to, minAmount, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (status) filter.status = status;

        if (creatorId) {
            filter.creatorId = creatorId;
        } else if (creatorEmail && String(creatorEmail).trim()) {
            const u = await User.findOne({
                email: new RegExp(`^${String(creatorEmail).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            }).select('_id');
            filter.creatorId = u ? u._id : { $exists: false };
        }

        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        if (minAmount !== undefined && minAmount !== '' && !isNaN(parseFloat(minAmount))) {
            filter.totalAmount = { $gte: parseFloat(minAmount) };
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

// ─── Super Admin: CSV export (same filters as getAllRequests, no pagination cap on export) ─

exports.exportAdminRequestsCsv = async (req, res) => {
    try {
        const { status, creatorId, creatorEmail, from, to, minAmount } = req.query;
        const filter = {};
        if (status) filter.status = status;

        if (creatorId) {
            filter.creatorId = creatorId;
        } else if (creatorEmail && String(creatorEmail).trim()) {
            const u = await User.findOne({
                email: new RegExp(`^${String(creatorEmail).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            }).select('_id');
            filter.creatorId = u ? u._id : { $exists: false };
        }

        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        if (minAmount !== undefined && minAmount !== '' && !isNaN(parseFloat(minAmount))) {
            filter.totalAmount = { $gte: parseFloat(minAmount) };
        }

        const rows = await PayoutRequest.find(filter)
            .sort({ createdAt: -1 })
            .limit(5000)
            .populate('creatorId', 'name email role')
            .populate('settledBy', 'name email')
            .lean();

        const esc = (v) => {
            if (v === undefined || v === null) return '';
            const s = String(v);
            if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
            return s;
        };

        const header = [
            'id', 'createdAt', 'status', 'creatorName', 'creatorEmail', 'totalAmount', 'currency',
            'totalWatchMinutes', 'ratePerMinute', 'paymentMethod', 'settledAt', 'adminNote',
        ].join(',');

        const lines = rows.map((r) =>
            [
                esc(r._id),
                esc(r.createdAt?.toISOString?.() || r.createdAt),
                esc(r.status),
                esc(r.creatorId?.name),
                esc(r.creatorId?.email),
                esc(r.totalAmount),
                esc(r.currency),
                esc(r.totalWatchMinutes),
                esc(r.ratePerMinute),
                esc(r.paymentMethod),
                esc(r.settledAt?.toISOString?.() || r.settledAt || ''),
                esc(r.adminNote),
            ].join(',')
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="payout-requests.csv"');
        res.send([header, ...lines].join('\n'));
    } catch (err) {
        console.error('exportAdminRequestsCsv error:', err.message);
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

        const internal = Math.abs(
            request.totalAmount - request.totalWatchMinutes * request.ratePerMinute
        );
        if (internal > SETTLE_AMOUNT_TOLERANCE) {
            return res.status(409).json({
                message: 'Payout request totals are internally inconsistent.',
            });
        }

        for (const row of request.videoBreakdown || []) {
            const v = await Video.findById(row.videoId).select('duration');
            const dur = v?.duration ?? 0;
            const cur = await sumEligibleWatchSecondsForVideo(row.videoId, dur);
            if (cur + 1e-6 < row.watchTimeAtRequest) {
                return res.status(409).json({
                    message: 'Watch time data no longer supports this payout snapshot. Review before settling.',
                    videoId: row.videoId,
                    snapshotSeconds: row.watchTimeAtRequest,
                    currentEligibleSeconds: cur,
                });
            }
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

/**
 * Finalize a continuous session into maxCompletedSessionSeconds (longest single session).
 */
function finalizeEndedSession(session) {
    const ended = session.currentSessionSeconds || 0;
    if (ended > 0) {
        session.maxCompletedSessionSeconds = Math.max(session.maxCompletedSessionSeconds || 0, ended);
    }
    session.currentSessionSeconds = 0;
    session.currentSessionStartedAt = null;
}

async function ensureDeviceBinding(videoId, deviceFingerprint, userId) {
    if (!deviceFingerprint || typeof deviceFingerprint !== 'string' || !deviceFingerprint.trim()) {
        return { ok: false, message: 'deviceFingerprint is required' };
    }
    const fp = deviceFingerprint.trim().slice(0, 128);

    let binding = await VideoWatchDeviceBinding.findOne({ videoId, deviceFingerprint: fp });
    if (binding) {
        if (String(binding.userId) !== String(userId)) {
            return { ok: false, message: 'This device is already linked to another account for payout watch time on this video.' };
        }
        return { ok: true, fp };
    }

    try {
        await VideoWatchDeviceBinding.create({ videoId, deviceFingerprint: fp, userId });
        return { ok: true, fp };
    } catch (e) {
        if (e.code === 11000) {
            binding = await VideoWatchDeviceBinding.findOne({ videoId, deviceFingerprint: fp });
            if (binding && String(binding.userId) !== String(userId)) {
                return { ok: false, message: 'This device is already linked to another account for payout watch time on this video.' };
            }
            return { ok: true, fp };
        }
        throw e;
    }
}

// ─── Video: Track Watch Time (max single session per user + device binding) ───
/**
 * POST /payout/video/:id/watchtime
 * Body: { seconds: number, deviceFingerprint: string }
 * Requires: authenticated user; paid/rent videos only
 */
exports.trackWatchTime = async (req, res) => {
    try {
        const videoId = req.params.id;
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: 'Authentication required to track watch time' });
        }

        let { seconds, deviceFingerprint } = req.body;
        seconds = parseFloat(seconds);

        const bind = await ensureDeviceBinding(videoId, deviceFingerprint, userId);
        if (!bind.ok) {
            return res.status(403).json({ message: bind.message });
        }
        const fp = bind.fp;

        if (!seconds || isNaN(seconds) || seconds < MIN_CHUNK_SECONDS) {
            return res.json({ message: 'Chunk too short — not recorded', credited: 0 });
        }

        seconds = Math.min(seconds, MAX_CHUNK_SECONDS);

        const video = await Video.findById(videoId).select('duration stats monetization');
        if (!video) return res.status(404).json({ message: 'Video not found' });

        const mType = video.monetization?.type;
        if (mType !== 'paid' && mType !== 'rent') {
            return res.status(403).json({ message: 'Watch time tracking only applies to paid or rent videos' });
        }

        const videoDuration = video.duration ?? 0;

        let session = await VideoWatchSession.findOne({ videoId, userId });
        if (!session) {
            session = new VideoWatchSession({ videoId, userId, deviceFingerprint: fp });
        } else if (fp && session.deviceFingerprint !== fp) {
            session.deviceFingerprint = fp;
        }

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);

        const gapSecs = session.lastCreditedAt
            ? (now - session.lastCreditedAt) / 1000
            : Infinity;

        if (gapSecs > SESSION_GAP_RESET_S) {
            finalizeEndedSession(session);
        }

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

        const sessionRemaining = SINGLE_SESSION_CAP_S - session.currentSessionSeconds;
        seconds = Math.min(seconds, Math.max(0, sessionRemaining));

        if (seconds < MIN_CHUNK_SECONDS) {
            return res.json({ message: 'Session cap reached — resume after a 30 min break', credited: 0 });
        }

        if (session.todayDate !== todayStr) {
            session.todayCreditedSeconds = 0;
            session.todayDate = todayStr;
        }
        const dailyRemaining = DAILY_CAP_SECONDS - session.todayCreditedSeconds;
        seconds = Math.min(seconds, Math.max(0, dailyRemaining));

        if (seconds < MIN_CHUNK_SECONDS) {
            return res.json({ message: 'Daily cap reached for this video — come back tomorrow', credited: 0 });
        }

        if (videoDuration > 0) {
            const sessionCap = videoDuration;
            const remainingInSession = Math.max(0, sessionCap - session.currentSessionSeconds);
            seconds = Math.min(seconds, remainingInSession);
            if (seconds < MIN_CHUNK_SECONDS) {
                return res.json({ message: 'Max single-session watch time reached for this video length', credited: 0 });
            }
        }

        seconds = Math.floor(seconds);

        session.totalCreditedSeconds += seconds;
        session.todayCreditedSeconds += seconds;
        session.currentSessionSeconds += seconds;
        session.lastCreditedAt = now;
        await session.save();

        const uniqueTotal = await recomputeVideoWatchTimeStats(video._id, videoDuration);

        res.json({
            message: 'Watch time recorded',
            credited: seconds,
            totalUniqueSeconds: uniqueTotal,
            maxCompletedSessionSeconds: session.maxCompletedSessionSeconds,
            currentSessionSeconds: session.currentSessionSeconds,
        });
    } catch (err) {
        console.error('trackWatchTime error:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};
