const mongoose = require('mongoose');
const Comment = require('../../models/comment');
const View = require('../../models/view');
const Like = require('../../models/like');
const Video = require('../../models/video');

/** Like schema requires `ip`; always set from request (fallback if proxy headers missing). */
function requestIp(req) {
    return req.ip || req.socket?.remoteAddress || '0.0.0.0';
}

// Comment Controllers
exports.createComment = async (req, res) => {
    try {
        const { videoId, text } = req.body;
        const comment = new Comment({
            videoId,
            userId: req.user?._id,
            text,
            ip: req.ip
        });
        await comment.save();
        await Video.updateOne({ _id: videoId }, { $inc: { 'stats.comments': 1 } });
        res.status(201).json(comment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getComments = async (req, res) => {
    try {
        const { videoId } = req.params;
        const comments = await Comment.find({ videoId })
            .populate('userId', 'username name profileImage')
            .populate('replies.fromUser', 'username name profileImage');
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.addReply = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { reply } = req.body;
        const comment = await Comment.findById(commentId);
        
        comment.replies.push({
            fromUser: req.user?._id,
            reply,
            ipAddress: req.ip
        });
        
        await comment.save();
        res.json(comment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// View Controllers
exports.addView = async (req, res) => {
    try {
        const { videoId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(videoId)) {
            return res.status(400).json({ message: 'Invalid video id' });
        }

        let existingView;
        if (req.user) {
            existingView = await View.findOne({
                videoId,
                userId: req.user._id,
            });
        } else {
            existingView = await View.findOne({
                videoId,
                ip: req.ip,
                $or: [{ userId: null }, { userId: { $exists: false } }],
            });
        }

        if (existingView) {
            return res.status(200).json(existingView);
        }

        const view = new View({
            videoId,
            userId: req.user?._id,
            ip: req.ip,
        });
        await view.save();

        await Video.updateOne({ _id: videoId }, { $inc: { 'stats.views': 1 } });

        res.status(201).json(view);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getViews = async (req, res) => {
    try {
        const { videoId } = req.params;
        const views = await View.find({ videoId });
        res.json({ count: views.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Like Controllers
exports.toggleLike = async (req, res) => {
    try {
        const { videoId } = req.params;
        const ip = requestIp(req);
        let like = await Like.findOne({ 
            videoId, 
            userId: req.user?._id || null,
            ip
        });

        if (like) {
            like.isLiked = !like.isLiked;
        } else {
            like = new Like({
                videoId,
                userId: req.user?._id,
                ip
            });
        }

        await like.save();
        res.json(like);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getLikes = async (req, res) => {
    try {
        const { videoId } = req.params;
        const likes = await Like.find({ videoId, isLiked: true });

        const userIdentifier = req.user?._id
            ? { userId: req.user._id }
            : { ip: req.ip };

        const userLike = await Like.findOne({
            videoId,
            isLiked: true,
            ...userIdentifier,
        });

        res.json({
            count: likes.length,
            likedByCurrentUser: !!userLike
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.toggleLikeDislike = async (req, res) => {
    try {
        const { videoId } = req.params;
        const { isLiked } = req.body; // true for like, false for dislike
        const ip = requestIp(req);
        const userIdentifier = req.user?._id ? { userId: req.user._id } : { ip };

        let existing = await Like.findOne({ videoId, ...userIdentifier });

        if (existing) {
            if (existing.isLiked === isLiked) {
                // Remove like/dislike
                await Like.deleteOne({ _id: existing._id });
                return res.json({ message: isLiked ? 'Like removed' : 'Dislike removed' });
            } else {
                // Switch like/dislike
                existing.isLiked = isLiked;
                await existing.save();
                return res.json({ message: isLiked ? 'Switched to like' : 'Switched to dislike' });
            }
        } else {
            await Like.create({
                videoId,
                isLiked,
                ip,
                ...(req.user?._id ? { userId: req.user._id } : {}),
            });
            return res.json({ message: isLiked ? 'Liked' : 'Disliked' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getDislikes = async (req, res) => {
    try {
        const { videoId } = req.params;
        const userIdentifier = req.user?._id ? { userId: req.user._id } : { ip: req.ip };

        const dislikes = await Like.find({ videoId, isLiked: false });
        const userDislike = await Like.findOne({ videoId, isLiked: false, ...userIdentifier });

        res.json({
            count: dislikes.length,
            dislikedByCurrentUser: !!userDislike
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
