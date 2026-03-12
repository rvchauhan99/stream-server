const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    like: {
        type: Number,
        default: 0
    },
    reply: {
        type: String,
        required: true
    },
    ipAddress: {
        type: String,
        required: true
    }
}, { timestamps: true });

const commentSchema = new mongoose.Schema({
    videoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    text: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    ip: {
        type: String,
        required: true
    },
    likes: {
        type: Number,
        default: 0
    },
    replies: [replySchema]
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);
