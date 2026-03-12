const express = require('express');
const router = express.Router();
const interactionController = require('../../controller/interaction/controller');
const auth = require('../../middleware/authMiddleware'); // Assuming you have auth middleware

// Comment routes
router.post('/comments', auth.checkUser, interactionController.createComment);
router.get('/videos/:videoId/comments',auth.checkUser, interactionController.getComments);
router.post('/comments/:commentId/replies', auth.checkUser, interactionController.addReply);

// View routes
router.post('/videos/:videoId/views', auth.checkUser, interactionController.addView);
router.get('/videos/:videoId/views', auth.checkUser, interactionController.getViews);

// Like routes
router.post('/videos/:videoId/likes', auth.checkUser, interactionController.toggleLike);
router.get('/videos/:videoId/likes', auth.checkUser, interactionController.getLikes);

// Toggle like or dislike
router.post('/like-dislike/:videoId', interactionController.toggleLikeDislike);

// Get likes
router.get('/likes/:videoId', interactionController.getLikes);

// Get dislikes
router.get('/dislikes/:videoId', interactionController.getDislikes);

module.exports = router;
