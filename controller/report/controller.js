const mongoose = require('mongoose');
const Video = require('../../models/video');
const VideoReport = require('../../models/videoReport');
const { sendEmail } = require('../../utils/mailer');

function requestIp(req) {
  return req.ip || req.socket?.remoteAddress || '0.0.0.0';
}

function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

const ALLOWED_REASONS = new Set([
  'spam',
  'inappropriate',
  'copyright',
  'harassment',
  'misleading',
  'other',
]);

exports.createVideoReport = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { reason, details } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({ message: 'Invalid video id' });
    }

    if (!reason || typeof reason !== 'string' || !ALLOWED_REASONS.has(reason)) {
      return res.status(400).json({ message: 'Invalid report reason' });
    }

    const video = await Video.findById(videoId).populate('creatorId');
    if (!video) return res.status(404).json({ message: 'Video not found' });

    // Ensure creatorId has email for notification. (Fail closed: if creator lacks email, still allow report.)
    const creator = video.creatorId;

    const reporterIp = requestIp(req);
    const reporterUserId = req.user?._id;

    const report = await VideoReport.create({
      videoId: video._id,
      creatorId: video.creatorId?._id,
      reporterUserId: reporterUserId || undefined,
      reporterIp,
      reason,
      details: sanitizeText(details),
    });

    // First report triggers deactivation + email.
    if (video.isActive !== false) {
      video.isActive = false;
      await video.save();

      // Avoid crashing the report flow: email failures should not break deactivation.
      if (creator?.email) {
        const reporterLine = reporterUserId
          ? `Reporter: ${req.user?.name || req.user?.username || reporterUserId.toString()}\nReporter Email: ${req.user?.email || 'N/A'}`
          : `Reporter: Guest\nReporter IP: ${reporterIp}`;

        const subject = `Your video was reported: ${video.title}`;
        const text = [
          `Creator: ${creator.name || creator.username || 'N/A'}`,
          `Creator Email: ${creator.email}`,
          ``,
          `Video: ${video.title}`,
          `Video ID: ${video._id}`,
          ``,
          reporterLine,
          ``,
          `Reason: ${reason}`,
          `Details: ${sanitizeText(details) || '—'}`,
          ``,
          `Reported At: ${new Date().toISOString()}`,
          ``,
          'Note: This action deactivated the video immediately. You can reactivate it from /dashboard/videos.',
        ].join('\n');

        try {
          await sendEmail(creator.email, subject, text);
        } catch (e) {
          console.error('Report email send failed:', e?.message || e);
        }
      }
    }

    res.status(201).json({ message: 'Report received', reportId: report._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

