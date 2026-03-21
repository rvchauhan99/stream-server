require('dotenv').config();
const mongoose = require('mongoose');
const Video = require('../models/video');
const axios = require('axios');

const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;
const MONGO_URI = process.env.MONGO_URI;

async function backfillDurations() {
    if (!MONGO_URI) {
        console.error('MONGO_URI is missing');
        return;
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        let page = 0;
        let limit = 50;

        while (true) {
            const videos = await Video.find({ duration: 0, type: 'uploaded' })
                .skip(page * limit)
                .limit(limit);

            if (videos.length === 0) break;

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
                    console.error(`Failed to fetch duration for video ${video.videoId}:`, err.message);
                }
            }

            page++;
        }

        console.log('Backfill complete!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

backfillDurations();
