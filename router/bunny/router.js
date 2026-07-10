const express = require('express');
const app = express();
const controller = require('../../controller/bunny/controller');
const middleware = require('../../middleware/authMiddleware');

// All Bunny proxy routes require admin — never expose publicly
app.use(middleware.validateAdmin);

app.get('/', (req, res) => {
  controller.getAllVideos().then((data) => res.send(data)).catch((e) => res.status(500).json({ message: e.message }));
});
app.get('/video/:id', (req, res) => {
  controller.getVideoById(req.params.id).then((data) => res.send(data)).catch((e) => res.status(500).json({ message: e.message }));
});
app.delete('/video/:id', (req, res) => {
  controller.deleteVideo(req.params.id).then((data) => res.send(data)).catch((e) => res.status(500).json({ message: e.message }));
});
app.put('/video/:id', (req, res) => {
  controller.updateVideo(req.params.id, req.body).then((data) => res.send(data)).catch((e) => res.status(500).json({ message: e.message }));
});
app.get('/video/:id/resolutions', (req, res) => {
  controller.getVideoResolutions(req.params.id).then((data) => res.send(data)).catch((e) => res.status(500).json({ message: e.message }));
});
app.get('/video/:id/thumbnails', (req, res) => {
  controller.getThumbnails(req.params.id).then((data) => res.send(data)).catch((e) => res.status(500).json({ message: e.message }));
});

// Secure playback minting is admin-only here; public playback uses GET /video/:id after entitlement
app.get('/video/:id/getSecurePlaybackUrl', (req, res) => {
  controller.getSecurePlaybackUrl(req.params.id, 3600).then((data) => res.send(data)).catch((e) => res.status(500).json({ message: e.message }));
});

module.exports = app;
