const mongoose = require('mongoose');

const chestOpenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  amountCents: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  isFirstChest: { type: Boolean, default: false },
}, { versionKey: false });

module.exports = mongoose.model('ChestOpen', chestOpenSchema);
