const mongoose = require('mongoose');

const loginSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sessionId: { type: String, required: true, unique: true },
  ipAddress: String,
  browser: String,
  url: String,
  loginTime: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('LoginSession', loginSessionSchema);
