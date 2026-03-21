/**
 * Deletes all users and creates 3 demo accounts (viewer, creator, superadmin).
 * Run from stream-server: node SCRIPTS/resetUsers.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const LoginSession = require('../models/loginSession');
const LoginHistory = require('../models/loginHistory');
const Otp = require('../models/otp');

const ACCOUNTS = [
  { email: 'viewer@local.test', password: 'Viewer#2025', role: 'viewer', name: 'Demo Viewer' },
  { email: 'creator@local.test', password: 'Creator#2025', role: 'creator', name: 'Demo Creator' },
  { email: 'superadmin@local.test', password: 'SuperAdmin#2025', role: 'superadmin', name: 'Demo Super Admin' },
];

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI in .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');

  const deletedUsers = await User.deleteMany({});
  await LoginSession.deleteMany({});
  await LoginHistory.deleteMany({});
  await Otp.deleteMany({});
  console.log(`Removed ${deletedUsers.deletedCount} user(s), cleared sessions/OTP`);

  const saltRounds = 10;
  const created = [];
  for (const acc of ACCOUNTS) {
    const passwordHash = await bcrypt.hash(acc.password, saltRounds);
    const user = await User.create({
      name: acc.name,
      email: acc.email,
      passwordHash,
      role: acc.role,
    });
    created.push({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      password: acc.password,
    });
  }

  console.log('\n--- New accounts (save these credentials) ---');
  console.table(created.map(({ id, email, role, password }) => ({ id, email, role, password })));
  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
