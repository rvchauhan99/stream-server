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

const REPORT_DEACTIVATE_THRESHOLD = 3;

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

    const reportCount = await VideoReport.countDocuments({ videoId: video._id });
    let deactivated = false;
    if (reportCount >= REPORT_DEACTIVATE_THRESHOLD && video.isActive !== false) {
      video.isActive = false;
      await video.save();
      deactivated = true;
    }

    if (deactivated && creator?.email) {
      const reporterLine = reporterUserId
        ? `Reporter: ${req.user?.name || reporterUserId.toString()}\nReporter Email: ${req.user?.email || 'N/A'}`
        : `Reporter: Guest\nReporter IP: ${reporterIp}`;

      const subject = `Your video was deactivated after reports: ${video.title}`;
      const text = [
        `Creator: ${creator.name || 'N/A'}`,
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
        `Report count: ${reportCount}`,
        `Reported At: ${new Date().toISOString()}`,
        ``,
        'Note: The video was deactivated after multiple reports. You can reactivate it from /dashboard/videos after review.',
      ].join('\n');

      try {
        await sendEmail(creator.email, subject, text);
      } catch (e) {
        console.error('Report email send failed:', e?.message || e);
      }
    }

    res.status(201).json({
      message: 'Report received',
      reportId: report._id,
      deactivated,
      reportCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
