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
  try {
    const result = await mailchimp.lists.searchMembers(cfg.mailchimp.listId, email);
    return result.exact_matches.total_items > 0;
  } catch (e) {
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
