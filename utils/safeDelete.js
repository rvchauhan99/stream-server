const fs = require('fs');

async function safeDelete(path, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await fs.promises.unlink(path);
            return;
        } catch (err) {
            if (err.code === 'EBUSY' || err.code === 'EPERM') {
                // wait a bit before retrying
                await new Promise(res => setTimeout(res, 300));
            } else if (err.code === 'ENOENT') {
                return; // already deleted
            } else {
                throw err; // unknown error
            }
        }
    }
    console.warn(`⚠️ Could not delete: ${path} after ${retries} retries`);
}
module.exports = { safeDelete };