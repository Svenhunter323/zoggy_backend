const { Telegraf } = require('telegraf');
const cfg = require('../config');

let bot = null;

function getBot() {
  if (!cfg.telegram.token) return null;
  if (!bot) bot = new Telegraf(cfg.telegram.token);
  return bot;
}

// helper used in webhook route
async function isMember(telegram, channelId, userId) {
  try {
    const res = await telegram.getChatMember(channelId, userId);
    return ['member', 'administrator', 'creator'].includes(res.status);
  } catch {
    return false;
  }
}

module.exports = { getBot, isMember };
