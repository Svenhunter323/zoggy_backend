const cfg = require('../config');
const mailchimp = require('@mailchimp/mailchimp_marketing');

if (cfg.mailchimp.apiKey) {
  mailchimp.setConfig({
    apiKey: cfg.mailchimp.apiKey,
    server: cfg.mailchimp.server
  });
}

async function checkEmailExists(email) {
  if (!cfg.mailchimp.apiKey) return false;

  // Mailchimp requires MD5 of lowercase email for list member lookup
  const crypto = require('crypto');
  const subscriberHash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');

  try {
    const result = await mailchimp.lists.getListMember(cfg.mailchimp.listId, subscriberHash);
    return result.status === 'subscribed' || result.status === 'pending';
  } catch (e) {
    if (e?.response?.body?.title === 'Resource Not Found') {
      // Email not in list
      return false;
    }
    console.warn('[mailchimp] search error', e.message);
    return false;
  }
}

async function addToList(email) {
  if (!cfg.mailchimp.apiKey) return;
  try {
    await mailchimp.lists.addListMember(cfg.mailchimp.listId, {
      email_address: email,
      status: 'subscribed'
    });
  } catch (e) {
    // ignore duplicates etc.
    if (e?.response?.body?.title !== 'Member Exists') {
      console.warn('[mailchimp] add error', e.message);
    }
  }
}

module.exports = { addToList, checkEmailExists };
