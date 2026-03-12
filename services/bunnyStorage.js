const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE; // e.g. knightkings
const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY;

const BUNNY_STORAGE_ENDPOINT = `https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/`;

const CDN_BASE  = process.env.CDN_BASE;
/**
 * Upload file to Bunny Storage
 * @param {string} localFilePath - path to local file
 * @param {string} remoteFileName - filename to use in storage
 * @returns {string} public URL or Error
 */
async function uploadToBunnyStorage(localFilePath, remoteFileName) {
  try {
    console.log('Uploading to:', `${BUNNY_STORAGE_ENDPOINT}${remoteFileName}`);
    const fileStream = fs.readFileSync(localFilePath);

    
    let  test = await axios.put(`${BUNNY_STORAGE_ENDPOINT}${remoteFileName}`, fileStream, {
      headers: {
        AccessKey: BUNNY_STORAGE_API_KEY,
        'Content-Type': 'application/octet-stream'
      }
    });
    // console.log("uploade status  " , test);
    

    return `${BUNNY_STORAGE_ENDPOINT}${remoteFileName}`;
  } catch (error) {
    console.log('Upload Error:', error.message);
    console.error('Inner upload error:', error.message);

    return new Error('File upload failed');
  }
}

async function deleteFromBunnyStorage(fullUrl) {
  const fileName = fullUrl.replace(CDN_BASE, '');
  try {
    await axios.delete(`${BUNNY_STORAGE_ENDPOINT}${fileName}`, {
      headers: {
        AccessKey: BUNNY_STORAGE_API_KEY
      }
    });
    console.log(`✅ Deleted from Bunny: ${fileName}`);
    return true;
  } catch (err) {
    console.warn(`❌ Failed to delete from Bunny: ${fileName}`, err.message);
    return false;
  }
}

module.exports = { uploadToBunnyStorage  ,  deleteFromBunnyStorage};
