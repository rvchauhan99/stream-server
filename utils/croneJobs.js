const Subscription = require('../models/subscription');
const User = require('../models/user');

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


const cron = require('node-cron');
// const expireSubscriptions = require('./cron/subscriptionCron');
// Run every night at 12:00 AM
cron.schedule('00 00 * * *', async () => {
    console.log('Running subscription expiry check...');
    await expireSubscriptions();
}, {
    timezone: "Asia/Kolkata"
});

