// controllers/telegramBot.js
const { Telegraf, Markup } = require('telegraf');
const TelegramNonce = require('../models/TelegramNonce');
const User = require('../models/User');

// --- Config from env (NO inline comments in .env lines!) ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME; // only used by your frontend
const GROUP_ID = Number(process.env.TELEGRAM_CHANNEL_ID); // e.g., -1002990087294
const JOIN_REQUEST_LINK = `https://t.me/+${process.env.TELEGRAM_JOIN_INVITE_CODE}`; // e.g., https://t.me/+bbgFt9kc5ks5MTVi
const RETURN_URL = process.env.RETURN_URL; // e.g., https://.../api/telegram/callback
const NONCE_TTL_MIN = 15;

let bot = null;
let wired = false;

function ensureEnv() {
  if (!BOT_TOKEN) throw new Error('[tg] TELEGRAM_BOT_TOKEN missing');
  if (!Number.isFinite(GROUP_ID)) {
    console.warn('[tg] WARNING: TELEGRAM_CHANNEL_ID is not a number:', process.env.TELEGRAM_CHANNEL_ID);
  }
  if (!/^https:\/\/t\.me\/\+/.test(JOIN_REQUEST_LINK)) {
    console.warn('[tg] WARNING: JOIN_REQUEST_LINK looks odd:', JOIN_REQUEST_LINK);
  }
  if (!RETURN_URL || !/^https?:\/\//.test(RETURN_URL)) {
    console.warn('[tg] WARNING: RETURN_URL looks odd:', RETURN_URL);
  }
}

async function initBotPolling() {
  ensureEnv();

  if (!bot) {
    bot = new Telegraf(BOT_TOKEN);
    bot.catch((err) => console.error('[tg] bot.catch:', err));
  }

  console.log('[tg] Starting Telegram bot (polling)...');

  // --- Preflight ---
  try {
    const me = await bot.telegram.getMe();
    console.log(`[tg] getMe OK: @${me.username} (id ${me.id})`);
  } catch (err) {
    console.error('[tg] getMe FAILED (bad token or network):', err?.response?.description || err);
    return;
  }

  // Make sure webhook is removed so polling can start
  try {
    const info = await bot.telegram.getWebhookInfo();
    if (info?.url) {
      console.warn('[tg] Webhook is set → deleting to enable polling:', info.url);
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      console.log('[tg] Webhook deleted. Proceeding with polling.');
    } else {
      console.log('[tg] No webhook set. Polling is safe to start.');
    }
  } catch (err) {
    console.warn('[tg] getWebhookInfo failed (not fatal):', err?.response?.description || err);
  }

  // --- Handlers (wire once) ---
  if (!wired) {
    // /start auth_<NONCE>
    bot.start(async (ctx) => {
      const payload = (ctx.startPayload || '').trim();
      if (!payload.startsWith('auth_')) {
        return ctx.reply('Please tap “Connect Telegram” on the website to link your account.');
      }

      console.log('[tg] /start payload:', payload);
      const nonce = payload.slice(5);

      // Lookup nonce
      const row = await TelegramNonce.findOne({ nonce });
      if (!row) return ctx.reply('Link expired. Please try again from the website.');

      // TTL
      const ageMin = (Date.now() - row.createdAt.getTime()) / 60000;
      if (ageMin > NONCE_TTL_MIN) {
        row.status = 'expired'; await row.save();
        return ctx.reply('Link expired. Please try again from the website.');
      }

      // Bind Telegram user to nonce
      row.tgUserId = ctx.from.id;
      row.tgUsername = ctx.from.username || null;
      row.status = 'identified';
      await row.save();

      // Fast path: already a member?
      try {
        const m = await ctx.telegram.getChatMember(GROUP_ID, ctx.from.id);
        const inGroup = ['member', 'creator', 'administrator', 'restricted'].includes(m.status);
        if (inGroup) {
          row.status = 'verified'; row.verifiedAt = new Date(); await row.save();

          verifyUserInGroup(ctx, row);
          return;
          // const url = `${RETURN_URL}?nonce=${encodeURIComponent(nonce)}`;
          // return ctx.reply(
          //   '🎉 You are already in the group. Return to the site:',
          //   Markup.inlineKeyboard([[ Markup.button.url('Return to site', url) ]])
          // );
        }
      } catch (e) {
        console.warn('[tg] getChatMember failed (bot admin? correct GROUP_ID?):', e?.response?.description || e.message);
      }

      // Ask the user to request access (1 tap, inside Telegram app)
      return ctx.reply(
        '✅ Telegram connected.\nTap below to request access — I will approve you automatically.',
        Markup.inlineKeyboard([[ Markup.button.url('👉 Request to join', JOIN_REQUEST_LINK) ]])
      );
    });

    // Auto-approve join requests and DM the return link
    bot.on('chat_join_request', async (ctx) => {
      // console.log('[tg] chat_join_request:', ctx.update.chat_join_request);
      const { chat, from } = ctx.update.chat_join_request;
      if (chat.id !== GROUP_ID) return;

      try {
        await ctx.telegram.approveChatJoinRequest(chat.id, from.id);
      } catch (e) {
        console.error('[tg] approveChatJoinRequest failed:', e?.response?.description || e.message);
      }

      // Find the latest pending/identified nonce for this user
      const row = await TelegramNonce.findOne({
        tgUserId: from.id,
        status: { $in: ['pending', 'identified'] }
      }).sort({ createdAt: -1 });

      // If they joined without coming from site, just greet them
      if (!row) {
        try { await ctx.telegram.sendMessage(from.id, 'You’re in! Return to the site to continue.'); } catch {}
        return;
      }

      // TTL
      const ageMin = (Date.now() - row.createdAt.getTime()) / 60000;
      if (ageMin > NONCE_TTL_MIN) {
        row.status = 'expired'; await row.save();
        try { await ctx.telegram.sendMessage(from.id, 'Link expired. Please tap Connect Telegram again on the website.'); } catch {}
        return;
      }
    
      verifyUserInGroup(ctx, row);

      // // Mark verified & DM back link
      // row.status = 'verified';
      // row.verifiedAt = new Date();
      // await row.save();

      // // const url = `${RETURN_URL}?nonce=${encodeURIComponent(row.nonce)}`;
      // // try {
      // //   await ctx.telegram.sendMessage(
      // //     from.id,
      // //     '🎉 Approved! Return to the site to open your chest:',
      // //     { reply_markup: { inline_keyboard: [[{ text: 'Return to site', url }]] } }
      // //   );
      // // } catch (e) {
      // //   console.error('[tg] DM failed:', e?.response?.description || e.message);
      // // }
    });

    bot.on('message', (ctx) => {
      // console.log('[chat id]', ctx.chat.id, ctx.chat.title, ctx.chat.type);
      // For supergroups/channels this will look like -100xxxxxxxxxx
    });

    const verifyUserInGroup = async (ctx, row) => {
      try {
        // Attach Telegram to a user/session
        let user = await User.findById(row.userId);
        if (!user) {
          try { await ctx.telegram.sendMessage(row.tgUserId, 'Link expired or session error. Please tap Connect Telegram again on the website.'); } catch {}
          return;
        }
        
        user.telegramUserId = row.tgUserId;
        user.telegramJoinedOk = true;
        await user.save();
        
        await ctx.telegram.sendMessage(
          row.tgUserId,
          '🎉 Approved! Return to the site to open your chest!',
        );
      } catch (e) {
        console.error('[tg] saving user telegram info failed:', e);
        try { await ctx.telegram.sendMessage(row.tgUserId, 'Link expired or session error. Please tap Connect Telegram again on the website.'); } catch {}
      }
    };


    wired = true;
  }

  // --- Start polling (DO NOT await) ---
  bot.launch({
    dropPendingUpdates: true,
    polling: { timeout: 5, limit: 100 },             // short timeout avoids proxy hangs
    // allowedUpdates: ['message', 'chat_join_request'],
    onStart: (info) => {
      console.log(`[tg] Launched as @${info.username} (id ${info.id}) — polling started`);
    }
  });

  // // Heartbeat so you know process is alive
  // setInterval(() => console.log('[tg] heartbeat'), 10_000);

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

module.exports = {
  initBotPolling,
  // Optional helpers if you need them elsewhere:
  getBot: () => bot,
  getMemberInfo: async (telegram, chatId, userId) => {
    try {
      const res = await telegram.getChatMember(chatId, userId);
      const status = res?.status;
      const joined = ['creator', 'administrator', 'member', 'restricted'].includes(status);
      return { ok: joined, status, raw: res };
    } catch (e) {
      const description = e?.response?.description || e.message;
      return { ok: false, error: description };
    }
  }
};
