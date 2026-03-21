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

// Toggle like or dislike (optional auth: checkUser sets req.user when token present)
router.post('/like-dislike/:videoId', auth.checkUser, interactionController.toggleLikeDislike);

// Get likes / dislikes (optional auth for current-user state)
router.get('/likes/:videoId', auth.checkUser, interactionController.getLikes);

router.get('/dislikes/:videoId', auth.checkUser, interactionController.getDislikes);

module.exports = router;
