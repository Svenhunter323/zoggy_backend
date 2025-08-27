const mongoose = require('mongoose');
const cfg = require('./config');

async function connectDb() {
  await mongoose.connect(cfg.mongoUri, { autoIndex: true });
  console.log('[db] connected');
}

module.exports = connectDb;
