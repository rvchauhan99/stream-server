/**
 * Deletes all users and seeds 3 production accounts.
 * Against streaming-prod requires: CONFIRM_PROD_RESET=YES
 *
 * Usage: CONFIRM_PROD_RESET=YES node SCRIPTS/resetUsers.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const Video = require('../models/video');
const LoginSession = require('../models/loginSession');
const LoginHistory = require('../models/loginHistory');
const Otp = require('../models/otp');

const ACCOUNTS = [
  { email: 'creator@knightkings.com', password: 'Creator#2026', role: 'creator', name: 'NightKing Creator' },
  { email: 'admin@knightkings.com', password: 'Admin#2026', role: 'admin', name: 'NightKing Admin' },
  { email: 'superadmin@knightkings.com', password: 'SuperAdmin#2026', role: 'superadmin', name: 'NightKing Super Admin' },
];

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const dbName = mongoose.connection.name;
  console.log(`Connected to DB: ${dbName}`);

  if (dbName === 'streaming-prod' && process.env.CONFIRM_PROD_RESET !== 'YES') {
    console.error('Refusing to reset streaming-prod without CONFIRM_PROD_RESET=YES');
    process.exit(1);
  }

  const deletedUsers = await User.deleteMany({});
  await LoginSession.deleteMany({});
  await LoginHistory.deleteMany({});
  await Otp.deleteMany({});
  console.log(`Removed ${deletedUsers.deletedCount} user(s), cleared sessions/OTP`);

  const saltRounds = 10;
  const created = [];
  let creatorId = null;

  for (const acc of ACCOUNTS) {
    const passwordHash = await bcrypt.hash(acc.password, saltRounds);
    const user = await User.create({
      name: acc.name,
      email: acc.email,
      passwordHash,
      role: acc.role,
      isActive: true,
    });
    if (acc.role === 'creator') creatorId = user._id;
    created.push({ id: user._id.toString(), email: user.email, role: user.role, password: acc.password });
  }

  if (creatorId) {
    const videoResult = await Video.updateMany({}, { $set: { creatorId } });
    console.log(`Reassigned ${videoResult.modifiedCount} video(s) to new creator`);
  }

  console.table(created);
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
