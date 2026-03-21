/**
 * Sets each video's stats.views from View.countDocuments({ videoId }).
 * Run from stream-server: node SCRIPTS/backfillVideoViewCounts.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Video = require('../models/video');
const View = require('../models/view');

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI in .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const videos = await Video.find({}).select('_id').lean();
  let updated = 0;
  for (const v of videos) {
    const count = await View.countDocuments({ videoId: v._id });
    await Video.updateOne({ _id: v._id }, { $set: { 'stats.views': count } });
    updated += 1;
  }
  console.log(`Updated stats.views for ${updated} videos.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
