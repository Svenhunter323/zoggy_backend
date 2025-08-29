const jwt = require('jsonwebtoken');
const cfg = require('../config');
const User = require('../models/User');
const { 
  getBot, 
  getMemberInfo,
  approveChatJoinRequest,
} = require('../services/telegram');
const { verifyTelegramLogin } = require('../middleware/telegramAuth');
const TelegramNonce = require('../models/TelegramNonce');

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;
const NONCE_TTL_MIN = 15;

const login = async (req, res) => {
  try {
    // Support both flows: POST JSON (req.body) or GET redirect (req.query)
    const data = Object.keys(req.body || {}).length ? req.body : req.query;
    if (!data) return res.status(400).json({ ok: false, error: 'empty_payload' });

    // Verify Telegram signature (your verifyTelegramLogin should *not* throw)
    const result = verifyTelegramLogin(data, process.env.TELEGRAM_BOT_TOKEN, { maxAgeSeconds: 600 });
    if (!result.ok) {
      console.warn('[tg] Login: invalid signature:', result.error);
      return res.status(400).json({ ok: false, error: result.error || 'invalid_signature' });
    }

    // Get the Telegram user ID and cast to Number (your schema expects Number)
    const rawId = data.id ?? result.telegramId;
    const tgIdNum = Number(rawId);
    if (!Number.isFinite(tgIdNum)) {
      return res.status(400).json({ ok: false, error: 'bad_telegram_id' });
    }

    // Resolve your app user (depending on your auth)
    let user = req.user || null;
    const userId = user?.id || req.session?.userId;
    if (!user) {
      if (!userId) return res.status(401).json({ ok: false, error: 'no_app_user' });
      user = await User.findById(userId);
      if (!user) return res.status(401).json({ ok: false, error: 'no_app_user' });
    }

    // Save fields — only after we have a valid numeric tg id
    user.telegramUserId = tgIdNum;        // <- Number, matches your schema
    user.telegramJoinedOk = false;        // reset on re-link
    await user.save();
console.log(`[tg] Linked Telegram account for user ${user._id}`, { ok: true, telegram_id: tgIdNum });
    return res.json({ ok: true, telegram_id: tgIdNum });
  } catch (e) {
    console.error('[tg] login error', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};

// GET /api/telegram/deeplink
const getDeeplink = async (req, res) => {
  try {
    const user = req.user;
    
    if (!cfg.telegram.token || !process.env.TELEGRAM_BOT_USERNAME) {
      return res.status(503).json({ error: 'telegram_not_configured' });
    }

    // Create a token for the Telegram bot
    // const token = jwt.sign(
    //   { sub: user._id.toString(), v: user.authVersion },
    //   cfg.jwtSecret,
    //   { expiresIn: '1h' }
    // );

    const token = `${user._id.toString()}_${user.authVersion}`;

    const link = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`;

    res.json({ link });
  } catch (error) {
    console.error('[telegram] Get deeplink error:', error);
    res.status(500).json({ error: 'server_error' });
  }
};

// GET /api/telegram/verify-status
const getVerifyStatus = async (req, res) => {
  const user = req.user;
  if (!req.user) return res.json({ ok: true, telegram_verified: false, telegram_id: null });
  res.json({ 
    ok: true, 
    telegram_verified: !!user.telegramJoinedOk, 
    telegram_id: user.telegramUserId || null 
  });
};

const reCheck = async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ ok:false, error:"unauthorized" });
  if (!user?.telegramUserId) return res.status(400).json({ ok:false, error:"no_telegram_id" });

  try {
    const bot = getBot();
    if (!bot || !cfg.telegram.channelId) {
      return res.status(503).json({ ok: false, error: 'telegram_not_configured' });
    }
    const { ok: isMember, status, error } = await getMemberInfo(bot.telegram, bot.telegram.channelId, user.telegramUserId);
    
    if (isMember) {
      user.telegramJoinedOk = true;
      await user.save();
    }
    res.json({ ok:true, isMember });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.response?.data || e.message });
  }
};

const webHook = async (req, res) => {
  try {
    // Optional but recommended: verify Telegram secret-token header
    if (cfg.telegram.webhookSecretToken) {
      const t = req.get('x-telegram-bot-api-secret-token');
      if (t !== cfg.telegram.webhookSecretToken) {
        console.warn('[tg] bad secret token');
        return res.status(200).send('ok'); // respond ok to avoid retries, but ignore
      }
    }

    // console.log("[tg] Webhook update body: session checked");

    const update = req.body;

      // console.log("[tg] Handling update", Object.keys(update));
      if (update.chat_member) {
        console.log("[tg] Handling chat_member update", update.chat_member.new_chat_member.status);
        // Handle regular messages to detect user activity
      }
    if (update.chat_join_request || update.chat_member?.new_chat_member?.status === 'member') {
      console.log("[tg] Handling chat_join_request");
      const { chat, from } = update.chat_join_request ? update.chat_join_request : update.chat_member;
      const joinUserId = String(from.id);
      const chatId = chat.id;

      // Safety: make sure it’s the right chat
      if (String(chatId) !== String(cfg.telegram.channelId)) {
        // Ignore unknown chats
        return res.status(200).json({ ok:true });
      }

      console.log(`[tg] Join request from user ${joinUserId} for chat ${chatId}`);

      // Find app user who owns this telegram_id
      const appUser = await User.findOne({ telegramUserId: joinUserId });

      await approveChatJoinRequest(chatId, joinUserId);

      appUser.telegramJoinedOk = true;
      await appUser.save();

      return res.status(200).json({ ok:true });
    }

  } catch (error) {
    // If approval fails, you might want to log and fall back to recheck path
      return res.status(200).json({ ok:true });
  }
  return res.status(200).json({ ok:true });// respond ok to all other updates
};

// POST /api/telegram/verify
const markAsVerified = async (req, res) => {
  const user = req.user;
  if (!user.telegramUserId) {
    return res.status(400).json({ error: 'telegram_not_linked' });
  }
  const bot = getBot();
  if (!bot || !cfg.telegram.channelId) {
    return res.status(503).json({ error: 'telegram_not_configured' });
  }
  const info = await getMemberInfo(bot.telegram, cfg.telegram.channelId, user.telegramUserId);
  if (!info.ok) {
    return res.status(403).json({ error: 'not_a_member', status: info.status, detail: info.error });
  }
  await User.updateOne({ _id: user._id }, { $set: { telegramJoinedOk: true } });
  res.json({ success: true });
};

// POST /api/telegram/nonce
const createNonce = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ ok:false, error:"unauthorized" });

    const bot = getBot();
    if (!bot) {
      return res.status(503).json({ ok: false, error: 'telegram_not_configured' });
    }

    // Create a nonce for this user
    const nonce = await TelegramNonce.createForUser(user._id);

    res.json({ ok: true, nonce, botUsername: BOT_USERNAME });
  } catch (e) {
    console.error('[tg] create nonce error', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};

const callback = async (req, res) => {
  const { nonce } = req.query;
  const row = await TelegramNonce.findOne({ nonce });
  if (!row) return res.status(400).send('Invalid link');

  const ageMin = (Date.now() - row.createdAt.getTime()) / 60000;
  if (ageMin > NONCE_TTL_MIN) {
    row.status = 'expired'; await row.save();
    return res.status(410).send('Link expired');
  }
  if (row.status !== 'verified') return res.status(403).send('Not verified yet');

  // Attach Telegram to a user/session
  let user = await User.findById(row.userId);
  if (!user) {
    return res.status(400).send('No user account');
  }

  user.telegramUserId = row.tgUserId;
  user.telegramJoinedOk = true;
  await user.save();

  // TODO: markChestGatePassed(...)
  return res.redirect('/dashboard?connected=1');
};

module.exports = {
  login,
  getDeeplink,
  getVerifyStatus,
  webHook,
  reCheck,
  markAsVerified,
  createNonce,
  callback
};