/**
 * Ensure production indexes (safe to re-run).
 * Usage: node SCRIPTS/ensureIndexes.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const ops = [
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('users').createIndex({ role: 1, isActive: 1 }),
    db.collection('videos').createIndex({ videoId: 1 }, { unique: true, sparse: true }),
    db.collection('videos').createIndex({ creatorId: 1, createdAt: -1 }),
    db.collection('videos').createIndex({ isActive: 1, createdAt: -1 }),
    db.collection('subscriptions').createIndex({ userId: 1, status: 1, endDate: 1 }),
    db.collection('loginsessions').createIndex({ user: 1 }),
    db.collection('loginsessions').createIndex({ sessionId: 1 }, { unique: true }),
    db.collection('otps').createIndex({ email: 1 }),
    db.collection('otps').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ];

  const results = await Promise.allSettled(ops);
  results.forEach((r, i) => {
    console.log(i, r.status, r.status === 'fulfilled' ? r.value : r.reason?.message);
  });

  await mongoose.disconnect();
  console.log('Done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
