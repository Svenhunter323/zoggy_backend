const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, index: true, unique: true },
  emailVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },

  // referral system
  referralCode: { type: String, unique: true, index: true }, // e.g. hT7d9a
  referredBy: { type: String, index: true },                 // referralCode of inviter
  referralCount: { type: Number, default: 0 },

  // credits + chest
  credits: { type: Number, default: 0 },  // store as dollars*100? We keep decimals in cents for safety:
  cents: { type: Number, default: 0 },    // use this field for actual math
  firstChestOpened: { type: Boolean, default: false },
  lastOpenAt: { type: Date, default: null },
  openCount: { type: Number, default: 0 },

  // claim code for launch
  claimCode: { type: String, unique: true, index: true },

  // telegram
  telegramUserId: { type: Number, index: true },
  telegramUsername: String,
  telegramJoinedOk: { type: Boolean, default: false },

  // anti-fraud
  signupIp: String,
  signupUa: String,
  deviceId: String,  // front-end header x-device-id
  flags: {
    suspicious: { type: Boolean, default: false },
    reason: String
  },

  // auth
  authVersion: { type: Number, default: 1 } // bump to invalidate tokens globally if needed
}, { versionKey: false });

module.exports = mongoose.model('User', userSchema);
