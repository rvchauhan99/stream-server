/**
 * Backfills maxCompletedSessionSeconds from legacy totalCreditedSeconds (conservative),
 * then recomputes Video.stats.watchTime as sum of per-user payout-eligible seconds.
 *
 * Run from stream-server: node SCRIPTS/backfillVideoWatchSessionsPayout.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Video = require('../models/video');
const VideoWatchSession = require('../models/videoWatchSession');

function userEligibleSeconds(session, videoDuration) {
  const best = Math.max(
    session.maxCompletedSessionSeconds || 0,
    session.currentSessionSeconds || 0
  );
  if (videoDuration > 0) return Math.min(videoDuration, best);
  return best;
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI in .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);

  const sessions = await VideoWatchSession.find({});
  let sessionUpdates = 0;

  for (const s of sessions) {
    const v = await Video.findById(s.videoId).select('duration').lean();
    const dur = v?.duration ?? 0;
    const total = s.totalCreditedSeconds || 0;
    const conservativeMax = dur > 0 ? Math.min(dur, total) : total;
    const currentMax = s.maxCompletedSessionSeconds || 0;
    if (currentMax < conservativeMax) {
      await VideoWatchSession.updateOne(
        { _id: s._id },
        { $set: { maxCompletedSessionSeconds: conservativeMax } }
      );
      sessionUpdates += 1;
    }
  }

  const videoIds = await VideoWatchSession.distinct('videoId');
  let videoUpdates = 0;

  for (const vid of videoIds) {
    const v = await Video.findById(vid).select('duration').lean();
    const dur = v?.duration ?? 0;
    const rows = await VideoWatchSession.find({ videoId: vid }).lean();
    let sum = 0;
    for (const row of rows) {
      sum += userEligibleSeconds(row, dur);
    }
    await Video.updateOne({ _id: vid }, { $set: { 'stats.watchTime': sum } });
    videoUpdates += 1;
  }

  console.log(`Updated ${sessionUpdates} watch sessions (maxCompletedSessionSeconds).`);
  console.log(`Recomputed stats.watchTime for ${videoUpdates} videos.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
