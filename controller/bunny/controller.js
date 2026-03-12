const axios = require('axios');
const crypto = require('crypto');

require('dotenv').config();
// Set your API details here
const API_KEY = process.env.BUNNY_API_KEY;
const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;
const VIDEO_LIBRARY_URL = `https://video.bunnycdn.com/library/${LIBRARY_ID}`;
const TOKEN_AUTH_KEY = process.env.TOKEN_AUTH_KEY; // Replace with real private key

// Axios instance with auth
const api = axios.create({
  baseURL: VIDEO_LIBRARY_URL,
  headers: {
    Accept: 'application/json',
    AccessKey: API_KEY,
  },
});

// Upload already handled via TUS separately

// Get all videos
exports.getAllVideos = async () => {
  const res = await api.get('/videos');
  return res.data;
};

// Get video details
exports.getVideoById = async (videoId) => {
  const res = await api.get(`/videos/${videoId}`);
  return res.data;
};

// Delete a video
exports.deleteVideo = async (videoId) => {
  const res = await api.delete(`/videos/${videoId}`);
  return res.data;
};

// Update video metadata
exports.updateVideo = async (videoId, data) => {
  const res = await api.post(`/videos/${videoId}`, data);
  return res.data;
};

// Set a custom thumbnail (image must be Base64 encoded)
exports.setThumbnail = async (videoId, base64Image) => {
  const res = await api.post(`/videos/${videoId}/thumbnail`, { thumbnailFile: base64Image });
  return res.data;
};

// Generate Secure Playback URL with token
exports.getSecurePlaybackUrl =async (videoId, expirationInSeconds = 3600) => {
  const baseUrl = `https://vz-${videoId}.b-cdn.net/${videoId}/playlist.m3u8`;
  const expiration = Math.floor(Date.now() / 1000) + expirationInSeconds;
  const tokenString = `${TOKEN_AUTH_KEY}${videoId}${expiration}`;
  const hash = crypto.createHash('sha256').update(tokenString).digest('hex');
  const token = `${hash}?token=${hash}&expires=${expiration}`;
  return `${baseUrl}?token=${hash}&expires=${expiration}`;
};

// Enable or disable DRM, captions, geo-block, etc.
exports.setVideoOptions = async (videoId, options = {}) => {
  const res = await api.post(`/videos/${videoId}`, options);
  return res.data;
};

// Create a new video entry (used before TUS upload if needed)
exports.createVideoEntry = async (title = 'Untitled') => {
  const res = await api.post(`/videos`, {
    title,
  });
  return res.data;
};

// List all thumbnails for a video
exports.getThumbnails = async (videoId) => {
  const res = await api.get(`/videos/${videoId}/thumbnails`);
  return res.data;
}
exports.getVideoResolutions = async (videoId) => {
    const res = await axios.get(
      `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}/resolutions`,
      {
        headers: {
          accept: 'application/json',
          AccessKey: API_KEY,
        },
      }
    );
    return res.data;
  };