// models/TelegramNonce.js
const mongoose = require('mongoose');
const uuid = require('uuid');

const TelegramNonceSchema = new mongoose.Schema({
  nonce: { type: String, unique: true, index: true },
  status: { type: String, enum: ['pending','identified','verified','expired'], default: 'pending', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  tgUserId: { type: Number, index: true },
  tgUsername: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
  verifiedAt: { type: Date }
});

// createForUser
TelegramNonceSchema.statics.createForUser = async function(userId) {
  const nonce = uuid.v4().replace(/-/g,'');
  const row = new this({ nonce, userId, status: 'pending' });
  await row.save();
  return nonce;
};

module.exports = mongoose.model('TelegramNonce', TelegramNonceSchema);
