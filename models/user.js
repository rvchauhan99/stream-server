// models/User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['viewer', 'creator', 'admin', 'superadmin'],
    default: 'viewer'
  },
  profileImage: {
    type: String,
    default: ''
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    default: null,
  },
  preferences: {
    quality: {
      type: String,
      enum: ['auto', '1080p', '720p', '480p'],
      default: 'auto'
    },
    notifications: {
      type: Boolean,
      default: true
    },
    autoplay: {
      type: Boolean,
      default: true
    }
  },
  isActive : {
    type : Boolean,
    default : true
  }                                      
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
