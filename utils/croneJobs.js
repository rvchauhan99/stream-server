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
const Video = require('../models/video');
const axios = require('axios');

const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;

async function updateVideoDurations() {
    try {
        const videos = await Video.find({ duration: 0, type: 'uploaded' }).limit(50);
        if (videos.length === 0) return;

        for (const video of videos) {
            try {
                const res = await axios.get(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${video.videoId}`, {
                    headers: { AccessKey: BUNNY_API_KEY }
                });
                
                if (res.data && res.data.length > 0) {
                    video.duration = res.data.length;
                    await video.save();
                    console.log(`Updated video ${video.videoId} duration to ${video.duration} seconds.`);
                }
            } catch (err) {
                // Ignore API errors, simply log them and continue
                console.error(`Failed to fetch duration for video ${video.videoId}:`, err.message);
            }
        }
    } catch (err) {
         console.error('Error running video duration update cron:', err.message);
    }
}

// Run every night at 12:00 AM
cron.schedule('00 00 * * *', async () => {
    console.log('Running subscription expiry check...');
    await expireSubscriptions();
}, {
    timezone: "Asia/Kolkata"
});

// Run every 5 minutes to backfill video lengths
cron.schedule('*/5 * * * *', async () => {
    console.log('Running video duration check...');
    await updateVideoDurations();
}, {
    timezone: "Asia/Kolkata"
});

