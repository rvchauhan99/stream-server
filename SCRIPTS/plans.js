const mongoose = require('mongoose');
const Plan = require('../models/plan'); // Adjust path as needed

// mongoose.connect('mongodb://localhost:27017/your-db-name', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });

const userId = new mongoose.Types.ObjectId('680f451b639acae2f47c7a68');

const plans = [
  {
    name: 'Basic',
    description: 'Basic plan with HD streaming on one device',
    features: [
      'HD Quality Streaming',
      'Watch on 1 Device',
      'Ad-Free Experience',
      'Download Videos',
      '7-Day Free Trial',
    ],
    price: 9.99,
    validity: 1,
    createdBy: userId,
    updatedBy: userId,
  },
  {
    name: 'Premium',
    description: 'Most popular plan with 4K streaming on up to 4 devices',
    features: [
      '4K Ultra HD Streaming',
      'Watch on 4 Devices',
      'Ad-Free Experience',
      'Download Videos',
      '30-Day Free Trial',
      'Exclusive Content Access',
      'Priority Support',
    ],
    price: 19.99,
    validity: 1,
    createdBy: userId,
    updatedBy: userId,
  },
  {
    name: 'Pro',
    description: 'Top-tier plan with 8K streaming and unlimited devices',
    features: [
      '8K Ultra HD Streaming',
      'Watch on Unlimited Devices',
      'Ad-Free Experience',
      'Download Videos',
      '45-Day Free Trial',
      'Exclusive Content Access',
      '24/7 Priority Support',
      'Early Access to New Features',
      'Custom Profile Themes',
    ],
    price: 29.99,
    validity: 1,
    createdBy: userId,
    updatedBy: userId,
  },
];

Plan.insertMany(plans).then(() => {
  console.log('Plans inserted successfully');
}).catch((err) => {
  console.error('Error inserting plans:', err);
});
  