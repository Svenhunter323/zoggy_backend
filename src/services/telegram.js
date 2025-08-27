const { Telegraf } = require('telegraf');
const cfg = require('../config');

let bot = null;

function getBot() {
  if (!cfg.telegram.token) return null;
  if (!bot) bot = new Telegraf(cfg.telegram.token);
  return bot;
}

// helper used in webhook route
async function getMemberInfo (telegram, chatId, userId) {
  try {
    const res = await telegram.getChatMember(chatId, userId);
    const status = res?.status;
    const joined = ['creator', 'administrator', 'member', 'restricted'].includes(status);
    return { ok: joined, status, raw: res };
  } catch (e) {
    // Surface why it failed (e.g. bot not admin in channel, chat not found, etc.)
    const description = e?.response?.description || e.message;
    return { ok: false, error: description };
  }
}

module.exports = { getBot, getMemberInfo };
