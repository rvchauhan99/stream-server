const cron = require('node-cron');
const mongoose = require('mongoose');
const Subscription = require('../models/subscription');
const User = require('../models/user');
const Video = require('../models/video');
const axios = require('axios');

const BUNNY_API_KEY = (process.env.BUNNY_API_KEY || '').trim();
const BUNNY_LIBRARY_ID = (process.env.BUNNY_LIBRARY_ID || '').trim();

const lockSchema = new mongoose.Schema({
  _id: { type: String },
  expiresAt: { type: Date, required: true },
});
const JobLock = mongoose.models.JobLock || mongoose.model('JobLock', lockSchema);

async function withJobLock(lockId, ttlMs, fn) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const existing = await JobLock.findById(lockId);
  if (existing && existing.expiresAt > now) {
    console.log(`Cron lock held: ${lockId}`);
    return;
  }
  try {
    if (!existing) {
      await JobLock.create({ _id: lockId, expiresAt });
    } else {
      const updated = await JobLock.findOneAndUpdate(
        { _id: lockId, expiresAt: { $lte: now } },
        { $set: { expiresAt } },
        { new: true }
      );
      if (!updated) {
        console.log(`Cron lock race lost: ${lockId}`);
        return;
      }
    }
  } catch (e) {
    if (e?.code === 11000) {
      console.log(`Cron lock busy: ${lockId}`);
      return;
    }
    throw e;
  }

  try {
    await fn();
  } finally {
    await JobLock.deleteOne({ _id: lockId }).catch(() => {});
  }
}

async function expireSubscriptions() {
  try {
    const now = new Date();
    const expiredSubscriptions = await Subscription.find({
      endDate: { $lte: now },
      status: 'active',
    });

    for (const subscription of expiredSubscriptions) {
      subscription.status = 'expired';
      await subscription.save();
      await User.findOneAndUpdate(
        { subscriptionId: subscription._id },
        { subscriptionId: null }
      );
    }

    console.log(`${expiredSubscriptions.length} subscriptions expired.`);
  } catch (err) {
    console.error('Error running subscription cron:', err.message);
  }
}

async function updateVideoDurations() {
  try {
    const videos = await Video.find({ duration: 0, type: 'uploaded' }).limit(50);
    if (videos.length === 0) return;

    for (const video of videos) {
      try {
        const res = await axios.get(
          `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${video.videoId}`,
          { headers: { AccessKey: BUNNY_API_KEY } }
        );

        if (res.data && res.data.length > 0) {
          video.duration = res.data.length;
          await video.save();
          console.log(`Updated video ${video.videoId} duration to ${video.duration} seconds.`);
        }
      } catch (err) {
        console.error(`Failed to fetch duration for video ${video.videoId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error running video duration update cron:', err.message);
  }
}

cron.schedule(
  '00 00 * * *',
  async () => {
    console.log('Running subscription expiry check...');
    await withJobLock('cron:expireSubscriptions', 10 * 60 * 1000, expireSubscriptions);
  },
  { timezone: 'Asia/Kolkata' }
);

cron.schedule(
  '*/5 * * * *',
  async () => {
    console.log('Running video duration check...');
    await withJobLock('cron:updateVideoDurations', 4 * 60 * 1000, updateVideoDurations);
  },
  { timezone: 'Asia/Kolkata' }
);

module.exports = { expireSubscriptions, updateVideoDurations };
