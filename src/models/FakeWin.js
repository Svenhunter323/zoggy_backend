const mongoose = require('mongoose');

const fakeWinSchema = new mongoose.Schema({
  username: String,
  amount: Number, // in dollars, float for display
  avatar: String, // avatar identifier/URL
  country: {
    flag: String, // country flag emoji
    name: String, // country name
    code: String  // country code (US, CA, UK, etc.)
  },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

fakeWinSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FakeWin', fakeWinSchema);
