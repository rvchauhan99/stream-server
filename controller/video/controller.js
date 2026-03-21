const fs = require("fs");
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { uploadToBunnyStorage } = require('../../services/bunnyStorage');
const { deleteFromBunnyStorage } = require('../../services/bunnyStorage');
const { validateCreateThirdPartyVideo } = require('../../middleware/video');
const axios = require("axios");
const tus = require("tus-js-client");
const crypto = require("crypto");
const Video = require('../../models/video'); // Adjust path as needed
const Like = require('../../models/like');
require("dotenv").config();
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;
const { validateCreateVideo } = require('../../middleware/video');
const { log } = require("console");
const upload = multer({ dest: 'temp/' }); // Temporary folder for uploads
const MAX_THUMBNAIL_SIZE = process.env.MAX_THUMBNAIL_SIZE ? process.env.MAX_THUMBNAIL_SIZE : 10 * 1024 * 1024; // 3 MB
const MAX_PREVIEW_SIZE = process.env.MAX_PREVIEW_SIZE ? process.env.MAX_PREVIEW_SIZE : 100 * 1024 * 1024;   // 5 MB
const { safeDelete } = require('../../utils/safeDelete');
const { logBunnyApiError } = require('../../utils/logBunnyApiError');
const { createSecureUrl } = require('../../utils/videoTokenAuth');


function generateSignature(libraryId, apiKey, expires, videoId) {
    const input = `${libraryId}${apiKey}${expires}${videoId}`;
    return crypto.createHash("sha256").update(input).digest("hex");
}
// Video upload
exports.uploadVideo = async (req, res) => {
    try {
        const { isValid, errors } = validateCreateVideo(req.body);

        if (!isValid) {
            return res.status(400).json({ message: "Validation failed", error: errors });
        }

        const { title, description, category, tags, visibility, socketId } = req.body;
        const file = req.file;

        console.log("socket id >>>", socketId)

        // Step 1: Create Bunny video entry (resumable = true)
        const createRes = await axios.post(
            `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`,
            {
                title,
                useResumable: true,
            },
            {
                headers: {
                    AccessKey: BUNNY_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        const { guid: videoId } = createRes.data;
        console.log("Video ID:", videoId);
        console.log("createRes.data", createRes.data);

        res.json({ message: 'Upload started', videoId });



        const uploadUrl = `https://video.bunnycdn.com/tusupload`;

        // Step 2: Generate secure signature
        const expires = Math.floor(Date.now() / 1000) + 3600; // valid for 1 hour
        const signature = generateSignature(
            BUNNY_LIBRARY_ID,
            BUNNY_API_KEY,
            expires,
            videoId
        );

        console.log("file.path", file.path);


        // Step 3: Upload using tus-js-client
        const fileStream = fs.createReadStream(file.path);
        const stats = fs.statSync(file.path);

        try {
            const upload = new tus.Upload(fileStream, {
                endpoint: uploadUrl,
                uploadSize: stats.size,
                retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
                headers: {
                    AuthorizationSignature: signature,
                    AuthorizationExpire: expires,
                    VideoId: videoId,
                    LibraryId: BUNNY_LIBRARY_ID,
                },
                metadata: {
                    filename: file.originalname,
                    filetype: file.mimetype,
                    title,
                },

                onError(error) {
                    console.error('TUS Upload failed:', error?.message || error);
                    if (error?.originalResponse != null) {
                        console.error('TUS originalResponse:', error.originalResponse);
                    }
                    req.io.to(socketId).emit("upload-error", {
                        videoId,
                        error: error.message || "Upload failed"
                    });
                },

                onProgress(bytesUploaded, bytesTotal) {

                    const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
                    console.log(`Upload Progress: ${percentage}%`);
                    req.io.to(socketId).emit("upload-progress", {
                        videoId,
                        percentage: percentage
                    });
                },
                async onSuccess() {
                    console.log("✅ TUS Upload completed!");
                    fs.unlinkSync(file.path); // cleanup

                    const monetizationType = (req.body.type || 'free').toLowerCase();

                    // Snapshot current payout rate for paid/rent videos
                    let payoutRateSnapshot = 0;
                    if (monetizationType === 'paid' || monetizationType === 'rent') {
                        try {
                            const PayoutRate = require('../../models/payoutRate');
                            const rateDoc = await PayoutRate.findOne({});
                            payoutRateSnapshot = rateDoc?.ratePerMinute ?? 0;
                        } catch (e) {
                            console.warn('Could not fetch payout rate for snapshot:', e.message);
                        }
                    }

                    const newVideo = new Video({
                        creatorId: req.user?._id || null,
                        type: 'uploaded',
                        title,
                        description,
                        category,
                        tags,
                        visibility,
                        monetization: {
                            type: monetizationType,
                            currency: req.body.currency || 'INR',
                            price: parseFloat(req.body.price) || 0
                        },
                        drmEnabled: req.body.drmEnabled === 'true',
                        videoId,
                        filePath: `${process.env.BUNNY_STREAM_HOST}/${videoId}/playlist.m3u8`,
                        thumbnailPath: `${process.env.BUNNY_STREAM_HOST}/${videoId}/thumbnail.jpg`,
                        previewPath: `${process.env.BUNNY_STREAM_HOST}/${videoId}/preview.webp`,
                        duration: 0,
                        stats: {},
                        payoutRateSnapshot,
                    });

                    newVideo.save();


                    req.io.to(socketId).emit("upload-complete", {
                        message: "Video uploaded successfully",
                        videoId,
                        playbackUrl: newVideo.filePath
                    });


                },
            });

            // Optional: Resume support
            const previous = await upload.findPreviousUploads();
            if (previous.length) {
                upload.resumeFromPreviousUpload(previous[0]);
            }

            upload.start();
        } catch (error) {
            console.error("TUS Upload failed:", error);
            setImmediate(() => {
                req.io.to(socketId).emit("upload-error", {
                    videoId,
                    error: error.message || "Upload failed"
                });
            });
        }

    } catch (err) {
        logBunnyApiError('Stream create video (POST /library/.../videos)', err);
        res.status(500).json({
            error: 'Upload failed',
            bunny: err.response?.data ?? null,
        });
    }
}

// Delete uploaded video
exports.deleteUploadedVideo = async (req, res) => {
    try {
        const { videoId } = req.params;

        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        console.log("videoId", videoId);
        // Step 1: Find the video in your database
        const video = await Video.findOne({ videoId: videoId, type: 'uploaded' });

        console.log("video", video);

        if (!video) {
            return res.status(404).json({ message: 'Video not found or not an uploaded type' });
        }

        // Step 2: Delete video from Bunny.net
        await axios.delete(
            `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`,
            {
                headers: {
                    AccessKey: BUNNY_API_KEY
                }
            }
        );

        // Step 3 Delete from database
        await Video.deleteOne({ _id: video._id });
        return res.json({ message: 'Video deleted successfully from Bunny and Database.' });
    } catch (err) {
        logBunnyApiError('Stream delete video', err);
        res.status(500).json({
            message: 'Failed to delete video',
            bunny: err.response?.data ?? null,
        });
    }
};

//  Third Party  Video  Upload 

exports.uploadThirdPartyVideo = async (req, res) => {
    try {
        upload.fields([
            { name: 'thumbnail', maxCount: 1 },
            { name: 'preview', maxCount: 1 }
        ])(req, res, async (err) => {
            try {
                if (err) return res.status(400).json({ error: 'File upload error' });

                const { title, description, category, tags, visibility, filepath } = req.body;
                const { isValid, errors } = validateCreateThirdPartyVideo(req.body);

                if (!isValid) {
                    // Cleanup any uploaded files if validation fails
                    const files = req.files || {};
                    if (files.thumbnail?.[0]?.path) fs.unlinkSync(files.thumbnail[0].path);
                    if (files.preview?.[0]?.path) fs.unlinkSync(files.preview[0].path);
                    return res.status(400).json({ errors });
                }
                if (!filepath) {
                    // Cleanup any uploaded files if filepath is missing
                    const files = req.files || {};
                    if (files.thumbnail?.[0]?.path) fs.unlinkSync(files.thumbnail[0].path);
                    if (files.preview?.[0]?.path) fs.unlinkSync(files.preview[0].path);
                    return res.status(400).json({ error: 'Filepath is required' });
                }


                // Validate file sizes

                // log

                //     let findSameUrl = await Video.find({ filepath: "https://thirdparty.com/video/789" });
                //     console.log("findSameUrl", findSameUrl);
                //     if (findSameUrl) return res.status(400).json({ error: 'Video already exists' });
                let videoId = crypto.randomBytes(16).toString('hex');
                let timeStamps = Date.now();

                let thumbnailUrl = '';
                let previewUrl = '';
                let thumbNailFileName = videoId + '_thumbnail' + '.jpg';
                let previewFileName = videoId + '_preview' + '.webp';
                const files = req.files || {};

                if (files.thumbnail?.[0]?.size > MAX_THUMBNAIL_SIZE) {
                    fs.unlinkSync(files.thumbnail[0].path); // cleanup
                    return res.status(400).json({ error: `Thumbnail size must not exceed ${MAX_THUMBNAIL_SIZE / 1024 / 1024} MB` });
                }

                // console.log("files.preview?.[0]?.size", files.preview?.[0]?.size);

                if (files.preview?.[0]?.size > MAX_PREVIEW_SIZE) {
                    fs.unlinkSync(files.preview[0].path); // cleanup
                    return res.status(400).json({ error: `Preview size must not exceed ${MAX_PREVIEW_SIZE / 1024 / 1024} MB` });
                }

                if (files.preview?.length > 0) {
                    const previewFile = files.preview[0];
                    const ext = path.extname(previewFile.originalname).toLowerCase();

                    if (ext === '.webp') {
                        console.log("Stage 1");

                        const result = await uploadToBunnyStorage(previewFile.path, previewFileName);

                        if (result instanceof Error) return res.status(400).send({ message: 'Preview upload failed' });
                        previewUrl = result;
                        console.log("Stage 1 Passed ");

                    } else {
                        const webpPath = `temp/${previewFileName}`;
                        console.log("webP patth", webpPath);

                        await new Promise((resolve, reject) => {
                            ffmpeg(previewFile.path)
                                .outputOptions('-vcodec libwebp')
                                .outputOptions('-vf fps=10,scale=480:-1:flags=lanczos')
                                .toFormat('webp')
                                .save(webpPath)
                                .on('end', resolve)
                                .on('error', reject);
                        });
                        console.log("Stage 2");
                        const result = await uploadToBunnyStorage(webpPath, previewFileName);

                        if (result instanceof Error) return res.status(400).send({ message: 'Preview upload failed' });
                        previewUrl = result;
                        console.log("Stage 2 Passed ");
                        // if (files.thumbnail?.length > 0) {
                        fs.unlinkSync(webpPath);
                        // }

                    }
                    console.log("previewFile.path  ", previewFile.path)
                    fs.unlinkSync(previewFile.path);
                }

                if (files.thumbnail?.length > 0) {
                    const thumbnailFile = files.thumbnail[0];
                    if (path.extname(thumbnailFile.originalname).toLowerCase() !== '.jpg') return res.status(400).json({ error: 'Thumbnail must be a JPEG file' });
                    console.log("Stage 3");
                    const result = await uploadToBunnyStorage(thumbnailFile.path, thumbNailFileName);
                    if (result instanceof Error) return res.status(400).send({ message: 'Thumbnail upload failed' });
                    thumbnailUrl = result;
                    console.log("Stage 3 Passed ");

                    fs.unlinkSync(thumbnailFile.path);
                }
                console.log("entering fo preview only");

                if (!thumbnailUrl && previewUrl) {

                    const previewPath = `temp/${previewFileName}`;
                    const thumbPath = `temp/${thumbNailFileName}`
                    try {
                        // Step 1: Download from CDN
                        const response = await axios({
                            url: process.env.CDN_BASE + previewFileName,
                            method: 'GET',
                            responseType: 'stream'
                        });

                        console.log("✅ Preview downloaded from CDN");
                        // Save to local temp file
                        await new Promise((resolve, reject) => {
                            const writer = fs.createWriteStream(previewPath);
                            response.data.pipe(writer);
                            writer.on('finish', resolve);
                            writer.on('error', reject);
                        });

                        // Step 2: Convert to JPEG
                        await sharp(previewPath)
                            .jpeg()
                            .toFile(thumbPath);

                        console.log("✅ Converted preview to thumbnail JPG");

                        // Step 3: Upload thumbnail to Bunny
                        const result = await uploadToBunnyStorage(thumbPath, thumbNailFileName);
                        if (result instanceof Error) {
                            return res.status(400).json({ error: 'Thumbnail upload failed' });
                        }

                        thumbnailUrl = result;
                        console.log("✅ Thumbnail uploaded to Bunny", result);

                    } catch (err) {
                        // Cleanup both files in case of error
                        fs.unlinkSync(previewFile.path);
                        if (fs.existsSync(webpPath)) fs.unlinkSync(webpPath);
                        console.error("❌ Thumbnail generation error:", err.message);
                        return res.status(500).json({ error: 'Thumbnail generation failed' });
                    } finally {
                        // Cleanup both files after successful processing
                        fs.unlinkSync(previewFile.path);
                        if (fs.existsSync(webpPath)) fs.unlinkSync(webpPath);
                    }
                }

                if (!thumbnailUrl && !previewUrl) return res.status(400).send({ error: 'At least thumbnail or preview is required.' });

                const newVideo = new Video({
                    creatorId: req.user?._id || null,
                    type: 'thirdparty',
                    title,
                    videoId: videoId,
                    description,
                    category,
                    tags,
                    visibility,
                    filePath: filepath,
                    thumbnailPath: process.env.CDN_BASE + thumbNailFileName,
                    previewPath: files.preview?.length > 0 ? process.env.CDN_BASE + previewFileName : '',
                    monetization: { type: 'free', price: 0, currency: 'INR' },
                    drmEnabled: false,
                    stats: {}
                });

                await newVideo.save();
                return res.status(200).send({ message: 'Third party video uploaded successfully', videoId: newVideo._id });
            } catch (innerErr) {
                // Cleanup any remaining files in case of error
                const files = req.files || {};
                if (files.thumbnail?.[0]?.path) fs.unlinkSync(files.thumbnail[0].path);
                if (files.preview?.[0]?.path) fs.unlinkSync(files.preview[0].path);
                console.error('Inner upload error:', innerErr.message);
                return res.status(500).send({ error: 'Internal processing error' });
            }
        });
    } catch (err) {
        console.error('Outer error:', err);
        return res.status(500).send({ error: 'Upload failed' });
    }
};
// Delete third party video
exports.deleteThirdPartyVideo = async (req, res) => {
    try {
        const { videoId } = req.params;

        console.log("third Party Video id", videoId);

        const video = await Video.findOne({ videoId: videoId, type: 'thirdparty' });

        ;
        if (!video) return res.status(404).json({ error: 'third Party Video not found' });

        // Delete preview and thumbnail if present
        const previewDeleted = video.previewPath
            ? await deleteFromBunnyStorage(video.previewPath)
            : true;

        const thumbnailDeleted = video.thumbnailPath
            ? await deleteFromBunnyStorage(video.thumbnailPath)
            : true;

        // Remove from DB
        await Video.deleteOne({ _id: video._id });

        return res.status(200).json({
            message: 'Video deleted successfully',
            // previewDeleted,
            // thumbnailDeleted
        });

    } catch (err) {
        console.error('❌ Error deleting video:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
// Get third pary videos
exports.getThirdPartyVideos = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [videos, total] = await Promise.all([
            Video.find({ type: 'thirdparty' })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Video.countDocuments({ type: 'thirdparty' })
        ]);

        res.status(200).json({
            data: videos,
            meta: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Get videos error:', err);
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
};

exports.getVideos = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';

        // Base filter: search
        const filter = {
            ...(search && {
                $or: [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { tags: { $regex: search, $options: 'i' } }
                ]
            })
        };

        // Restrict if user is a creator
        if (req.user.role === 'creator') {
            filter.creatorId = req.user._id;
        }

        const videos = await Video.find(filter).populate('creatorId')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Video.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);

        res.status(200).json({
            page,
            totalPages,
            total,
            videos
        });
    } catch (err) {
        console.error('Error fetching videos:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.searchVideos = async (req, res) => {
    try {
        console.log("searchVideos called");
        const {
            search = '',
            category,
            monetization,
            visibility,
            tags,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            id
        } = req.query;

        if (id == 'liked') {
            return getLikedVideos(req, res);
        }

        const orConditions = [];

        // Partial match on title, description, tags (from search box)
        if (search) {
            const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapeRegex(search), 'i')
            orConditions.push(
                { title: regex },
                { description: regex },
                { tags: regex },
                { category: regex }
            );
        }

        // Partial match on category
        if (category) {
            orConditions.push({ category: { $regex: category, $options: 'i' } });
        }

        // Exact match on monetization.type

        console.log("monetization", monetization);

        if (monetization) {
            orConditions.push({ 'monetization.type': monetization == 'premium' ? { $in: ['rent', 'paid'] } : { $in: ['rent', 'paid', 'free'] } });
        }

        // Exact match on visibility
        if (visibility) {
            orConditions.push({ visibility });
        }

        // Match any tag from a comma-separated list (e.g., tags=funny,action)
        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim());
            orConditions.push({ tags: { $in: tagArray } });
        }

        const query = orConditions.length > 0 ? { $or: orConditions } : {};
        // Moderation hard-block: exclude deactivated content, but treat missing as active for legacy rows.
        query.isActive = { $ne: false };

        let sortOption = {};
        if (sortBy) {
            const allowedNested = ['views', 'likes', 'comments', 'shares', 'watchTime'];
            const field = sortBy.replace('-', '');

            if (allowedNested.includes(field)) {
                sortOption[`stats.${field}`] = sortOrder === 'asc' ? 1 : -1;
            } else {
                sortOption[field] = sortOrder === 'asc' ? 1 : -1;
            }
        }

        if (!sortOption[sortBy]) {
            sortOption[sortBy] = sortOrder === 'asc' ? 1 : -1;
        }


        const videos = await Video.find(query)
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('creatorId', 'username');

        const total = await Video.countDocuments(query);

        res.status(200).json({
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total,
            videos
        });
    } catch (err) {
        console.error('Error fetching videos:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
const mongoose = require('mongoose');

exports.getVideoDetails = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("videoId", id);
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid video id' });
        }
        const video = await Video.findById(id).populate('creatorId');
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }
        // Moderation hard-block: deactivated videos are not accessible for public viewers.
        if (video.isActive === false) {
            if (req.user) {
                const { role, _id: userId } = req.user;
                const creatorId = video.creatorId?._id || video.creatorId;
                const isOwner = role === 'creator' && String(creatorId) === String(userId);
                const isAdmin = role === 'admin' || role === 'superadmin';
                if (!isOwner && !isAdmin) {
                    return res.status(404).json({ error: 'Video is deactivated' });
                }
            } else {
                return res.status(404).json({ error: 'Video is deactivated' });
            }
        }
        if (video.monetization.type === 'paid' || video.monetization.type === 'rent') {
            if (!req.user) {
                return res.status(401).json({ error: 'Unauthorized' });
            } else {
                // const user = await User.findById(req.user.id);
                if (!req.user.subscriptionId) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }
            }
        }


        const videoObj = video.toObject();
        videoObj.src = createSecureUrl(videoObj?.videoId, req.user?._id);
        console.log("videoObj src", videoObj.src);

        res.status(200).json(videoObj);

    } catch (err) {
        console.error('Error fetching video:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getRelatedVideos = async (req, res) => {
    try {
        const { id } = req.params;
        const limit = Math.min(parseInt(req.query.limit, 10) || 24, 48);

        let currentVideo = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            currentVideo = await Video.findById(id).lean();
        }
        if (!currentVideo) {
            currentVideo = await Video.findOne({ videoId: id }).lean();
        }
        if (!currentVideo) {
            return res.status(404).json({
                success: false,
                message: 'Video not found',
            });
        }

        const excludeIds = [currentVideo._id];
        const excludeVideoIds = [currentVideo.videoId].filter(Boolean);

        const orConditions = [
            { category: currentVideo.category },
            { tags: { $in: currentVideo.tags || [] } },
            { creatorId: currentVideo.creatorId },
        ];
        if (typeof currentVideo.title === 'string' && currentVideo.title.trim() !== '') {
            const safe = currentVideo.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80);
            orConditions.push({ title: { $regex: safe, $options: 'i' } });
        }
        if (typeof currentVideo.description === 'string' && currentVideo.description.trim() !== '') {
            const safe = currentVideo.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 120);
            orConditions.push({ description: { $regex: safe, $options: 'i' } });
        }

        const relatedVideos = await Video.find({
            _id: { $nin: excludeIds },
            videoId: { $nin: excludeVideoIds },
            isActive: { $ne: false },
            $or: orConditions,
        })
            .sort({ 'stats.views': -1 })
            .limit(limit)
            .populate('creatorId', 'name username')
            .lean();

        const relatedCount = relatedVideos.length;
        let combined = [...relatedVideos];

        if (relatedVideos.length < limit) {
            const existingMongoIds = relatedVideos.map((v) => v._id);
            const existingBunnyIds = relatedVideos.map((v) => v.videoId);
            const remainingCount = limit - relatedVideos.length;

            const additionalVideos = await Video.find({
                _id: { $nin: [...excludeIds, ...existingMongoIds] },
                videoId: { $nin: [...excludeVideoIds, ...existingBunnyIds] },
                isActive: { $ne: false },
            })
                .sort({ 'stats.views': -1 })
                .limit(remainingCount)
                .populate('creatorId', 'name username')
                .lean();

            combined = [...relatedVideos, ...additionalVideos];
        } else {
            combined = relatedVideos;
        }

        res.json({
            success: true,
            videos: combined,
            relatedCount,
            page: 1,
            totalPages: 1,
            total: combined.length,
        });
    } catch (error) {
        console.error('Error fetching related videos:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch related videos',
            error: error.message,
        });
    }
};

// exports.getLikes = async (req, res) => {
//     try {
//         const { videoId } = req.params;
//         const userIdentifier = req.user?.id ? { userId: req.user.id } : { ip: req.ip };

//         const likes = await Like.find({ videoId, isLiked: true });
//         const userLike = await Like.findOne({ videoId, isLiked: true, ...userIdentifier });

//         res.json({
//             count: likes.length,
//             likedByCurrentUser: !!userLike
//         });
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// };

getLikedVideos = async (req, res) => {
    try {

        console.log("getLikedVideos called");
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        let query = {};
        query.isLiked = true;
        // query.ip = req.ip;

        // Check if user is logged in
        if (req.user) {
            query.$or = [
                {
                    userId: req.user._id,
                    ip: req.ip
                },
                {
                    ip: req.ip
                }
            ]

        } else {
            query.ip = req.ip;
        }

        console.log("query", query);

        // // Get all liked videos with pagination
        const likes = await Like.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'videoId',
                select: 'title description category tags thumbnailPath duration stats',
                populate: {
                    path: 'creatorId',
                    select: 'username email' // Add any other user fields you want
                }
            });

        console.log("likes", likes);

        // // Get total count for pagination
        const totalLikes = await Like.countDocuments(query);

        // // Format the response
        const likedVideos = likes.map(like => ({
            ...like.videoId.toObject(),
            likedAt: like.timestamp
        }));

        res.status(200).json({
            page: parseInt(page),
            totalPages: Math.ceil(totalLikes / limit),
            total: totalLikes,
            videos: likedVideos
        });



    } catch (error) {
        console.error('Error fetching liked videos:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching liked videos',
            message: error.message
        });
    }
};

// Update video metadata
exports.updateVideo = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category, tags, visibility, isActive } = req.body;

        const video = await Video.findById(id);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        // Only creator or admin can update
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            if (String(video.creatorId) !== String(req.user._id)) {
                return res.status(403).json({ message: 'Forbidden' });
            }
        }

        if (title !== undefined) video.title = title;
        if (description !== undefined) video.description = description;
        if (category !== undefined) video.category = category;
        if (tags !== undefined) video.tags = Array.isArray(tags) ? tags : JSON.parse(tags);
        if (visibility !== undefined) video.visibility = visibility;
        if (isActive !== undefined) video.isActive = Boolean(isActive);

        await video.save();
        res.status(200).json({ message: 'Video updated successfully', video });
    } catch (err) {
        console.error('Update video error:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};