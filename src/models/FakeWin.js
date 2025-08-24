const mongoose = require('mongoose');

const fakeWinSchema = new mongoose.Schema({
  username: String,
  amount: Number, // in dollars, float for display
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

fakeWinSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FakeWin', fakeWinSchema);
