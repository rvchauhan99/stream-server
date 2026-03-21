/**
 * Seeds default video streaming subscription plans (INR, sortOrder, features).
 * Idempotent: upserts by plan name.
 *
 * Usage (from stream-server): node SCRIPTS/seedSubscriptionPlans.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Plan = require('../models/plan');
const User = require('../models/user');

const PLANS = [
  {
    name: 'Basic',
    description: 'HD streaming for individuals on a single screen.',
    features: [
      'HD (720p) streaming',
      '1 simultaneous screen',
      'Ad-free catalogue',
      'Offline downloads on mobile',
    ],
    price: 99,
    currency: 'INR',
    validity: 1,
    highlight: false,
    sortOrder: 0,
    maxScreens: 1,
    isActive: true,
  },
  {
    name: 'Standard',
    description: 'Full HD for small households — great value.',
    features: [
      'Full HD (1080p) streaming',
      '2 simultaneous screens',
      'Ad-free catalogue',
      'Offline downloads',
      'Watch on TV & mobile',
    ],
    price: 199,
    currency: 'INR',
    validity: 1,
    highlight: false,
    sortOrder: 1,
    maxScreens: 2,
    isActive: true,
  },
  {
    name: 'Premium',
    description: '4K Ultra HD with the best experience — most popular.',
    features: [
      '4K UHD & HDR where available',
      '4 simultaneous screens',
      'Ad-free catalogue',
      'Offline downloads',
      'Priority support',
      'Early access to new originals',
    ],
    price: 399,
    currency: 'INR',
    validity: 1,
    highlight: true,
    sortOrder: 2,
    maxScreens: 4,
    isActive: true,
  },
  {
    name: 'Premium Annual',
    description: 'Best value — 12 months of Premium.',
    features: [
      'Everything in Premium',
      '12 months access',
      '4 simultaneous screens',
      '4K UHD where available',
    ],
    price: 3999,
    currency: 'INR',
    validity: 12,
    highlight: false,
    sortOrder: 3,
    maxScreens: 4,
    isActive: true,
  },
];

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const superAdmin = await User.findOne({ role: 'superadmin' }).select('_id').lean();
  const actorId = superAdmin?._id || null;

  for (const p of PLANS) {
    const validityDays = p.validity * 30;
    const doc = {
      ...p,
      validityDays,
      updatedBy: actorId,
    };
    const existing = await Plan.findOne({ name: p.name });
    if (existing) {
      await Plan.updateOne(
        { _id: existing._id },
        { $set: { ...doc, createdBy: existing.createdBy || actorId } }
      );
      console.log('Updated plan:', p.name);
    } else {
      await Plan.create({
        ...doc,
        createdBy: actorId,
        features: p.features,
      });
      console.log('Created plan:', p.name);
    }
  }

  const count = await Plan.countDocuments();
  console.log('\nDone. Total plans in DB:', count);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
