const mongoose = require('mongoose');

const GenericMasterSchema = new mongoose.Schema({
  key: { type: String, required: true },         // e.g., "category", "tag"
  value: { type: String, required: true },       // e.g., "Electronics"
  desc: { type: String },                        // Optional description
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  count : { type: Number, default: 0 },
  isActive : { type: Boolean, default: true }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

module.exports = mongoose.model('GenericMaster', GenericMasterSchema);
