const crypto = require('crypto');

const baseUrl = (process.env.BASE_URL || '').trim();
const libraryId = (process.env.BUNNY_LIBRARY_ID || '').trim();
const tokenSecurityKey = (process.env.TOKEN_AUTH_KEY || '').trim();

if (!baseUrl || !libraryId || !tokenSecurityKey) {
  console.error(
    'Missing Bunny playback config: BASE_URL, BUNNY_LIBRARY_ID, and TOKEN_AUTH_KEY are required'
  );
}

function generateToken(key, videoId, expirationTime) {
  const data = key + videoId + expirationTime;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Creates a secure URL for video embedding.
 * Call only after entitlement checks (requireVideoAccess / getVideoDetails).
 */
function createSecureUrl(videoId, expirationTimeInSeconds = 3600) {
  if (!baseUrl || !libraryId || !tokenSecurityKey) {
    throw new Error('Bunny playback is not configured');
  }
  const expirationTime =
    Math.floor(Date.now() / 1000) + (Number(expirationTimeInSeconds) || 3600);
  const token = generateToken(tokenSecurityKey, videoId, expirationTime);
  return `${baseUrl.replace(/\/?$/, '/')}embed/${libraryId}/${videoId}?token=${token}&expires=${expirationTime}&autoplay=false`;
}

module.exports = {
  generateToken,
  createSecureUrl,
};
