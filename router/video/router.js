const express = require('express')
const app = express()
const multer = require('multer');
const middleware = require('../../middleware/authMiddleware')
// const controller = require('../../controller/video/controller')
const controller = require('../../controller/video/controller')
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('video/')) {
      return cb(new Error('Only video uploads are allowed'));
    }
    cb(null, true);
  },
});
app.get('/getVideos', middleware.validateCreator, controller.getVideos);
app.post('/upload', middleware.validateCreator, upload.single('video'), controller.uploadVideo)
app.delete('/deleteUploadedVideo/:videoId', middleware.validateCreator, controller.deleteUploadedVideo)
app.post('/thirdparty/upload', middleware.validateCreator, controller.uploadThirdPartyVideo)
app.get('/thirdparty', middleware.validateCreator, controller.getThirdPartyVideos)
app.delete('/deleteThirdPartyVideo/:videoId', middleware.validateCreator, controller.deleteThirdPartyVideo)
app.get('/search', middleware.checkUser, controller.searchVideos);
app.put('/:id', middleware.validateCreator, controller.updateVideo);
const { requireVideoAccess } = require('../../middleware/videoAccess');
app.get('/:id', middleware.checkUser, requireVideoAccess, controller.getVideoDetails);
app.get('/related/:id', controller.getRelatedVideos);
// app.get('/liked', middleware.checkUser, controller.getLikedVideos);



module.exports = app


