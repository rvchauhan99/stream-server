const mongoose = require('mongoose');

/**
 * VideoWatchSession — tracks how many unique seconds each user has watched
 * a specific video. This is the authoritative source for payout watch time.
 *
 * Anti-abuse rules enforced in the controller:
 *  1. Per-user-per-video cap: credited seconds ≤ video duration
 *  2. Increment rate-limit: each API call can credit at most MAX_CHUNK_SECONDS
 *  3. Minimum meaningful chunk: < MIN_CHUNK_SECONDS is ignored (tab-switch noise)
 *  4. Cooldown per session: a "continuous session" cannot exceed SINGLE_SESSION_CAP_SECONDS
 *     without a gap — prevents leaving a tab open to farm watch time overnight
 *  5. Daily cap per user per video: cannot exceed DAILY_CAP_SECONDS per calendar day
 */
const videoWatchSessionSchema = new mongoose.Schema({
    videoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    // Legacy cumulative seconds (analytics); payout uses maxCompletedSessionSeconds + current session
    totalCreditedSeconds: {
        type: Number,
        default: 0,
    },
    // Longest completed continuous session (gap > SESSION_GAP_RESET ends a session)
    maxCompletedSessionSeconds: {
        type: Number,
        default: 0,
    },
    // Client device id (localStorage UUID) for audit / support
    deviceFingerprint: {
        type: String,
        default: '',
        trim: true,
    },
    // Seconds credited today (resets each calendar day)
    todayCreditedSeconds: {
        type: Number,
        default: 0,
    },
    // Date of the todayCreditedSeconds counter (used to detect new day)
    todayDate: {
        type: String, // YYYY-MM-DD for easy comparison
        default: '',
    },
    // Timestamp of the last credited heartbeat (to enforce streaming-speed check)
    lastCreditedAt: {
        type: Date,
        default: null,
    },
    // Running session seconds in the current "continuous" session
    currentSessionSeconds: {
        type: Number,
        default: 0,
    },
    // When the current session started
    currentSessionStartedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

// Compound index: one doc per user per video
videoWatchSessionSchema.index({ videoId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('VideoWatchSession', videoWatchSessionSchema);
