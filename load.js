console.log("load called .......");


const expiration = Math.floor(Date.now() / 1000) + 3600;

console.log('Expiration:', expiration.toString());


// const crypto = require('crypto');

// const tokenSecurityKey = 'feeccafe-73b8-4a69-b01d-ec4a06b8d176';
// const videoId = '2c6d2fdb-2784-4df6-956f-cf07147773a4';
// const expiration = '1747559014'; // Note: keep this as a string

// // Concatenate the values
// const data = tokenSecurityKey + videoId + expiration;

// // Generate SHA256 hex token
// const token = crypto.createHash('sha256').update(data).digest('hex');

// console.log('Generated Token:', token);

// // require("./SCRIPTS/genericMaster")