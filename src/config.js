require('dotenv').config();

const cfg = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8080),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,

  mailchimp: {
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: process.env.MAILCHIMP_SERVER_PREFIX,
    listId: process.env.MAILCHIMP_LIST_ID,
    from: process.env.MAIL_FROM
  },

  mailtrap: {
    host: process.env.MAILTRAP_HOST,
    port: Number(process.env.MAILTRAP_PORT || 2525),
    username: process.env.MAILTRAP_USERNAME,
    password: process.env.MAILTRAP_PASSWORD,
    secure: process.env.MAILTRAP_SECURE === 'true'
  },

  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    channelId: process.env.TELEGRAM_CHANNEL_ID,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    publicBaseUrl: process.env.PUBLIC_BASE_URL
  },

  antifraud: {
    maxPerIpPerDay: Number(process.env.MAX_SIGNUPS_PER_IP_PER_DAY || 5),
    allowSelfRef: process.env.ALLOW_SELF_REF === '1'
  },

  email: {
    from: process.env.EMAIL_FROM || 'noreply@zoggy.com',
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
};

module.exports = cfg;
