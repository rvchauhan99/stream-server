const crypto = require('crypto');
const { log } = require('util');
require('dotenv').config();
const baseUrl = process.env.BASE_URL ||  'https://iframe.mediadelivery.net/';
const libraryId = process.env.BUNNY_LIBRARY_ID || '427082';
const tokenSecurityKey = process.env.TOKEN_AUTH_KEY || 'feeccafe-73b8-4a69-b01d-ec4a06b8d176';


console.log("libraryId " , libraryId);
console.log("baseUrl " , baseUrl);
console.log("tokenSecurityKey " , tokenSecurityKey);


/**
 * Generates a secure token for video embedding

 */
function generateToken(tokenSecurityKey, videoId, expirationTime) {
    const data = tokenSecurityKey + videoId + expirationTime;
    console.log('Token components:', {
        tokenSecurityKey,
        videoId,
        expirationTime,
        data
    });
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Creates a secure URL for video embedding

 */
function createSecureUrl(videoId, expirationTimeInSeconds = 3600) {
    const expirationTime = Math.floor(Date.now() / 1000) + 3600;
    console.log("expiration", expirationTime);
    const token = generateToken(tokenSecurityKey, videoId, expirationTime);
    let url = `${baseUrl}embed/${libraryId}/${videoId}?token=${token}&expires=${expirationTime}&autoplay=false`;
    console.log("Generated URL:", url);



    return url;
}

// console.log("createSecureUrl", createSecureUrl('2c6d2fdb-2784-4df6-956f-cf07147773a4'));


module.exports = {
    generateToken,
    createSecureUrl,
}; 