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
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.warn('[mailchimp] Invalid email format:', email);
    return;
  }
  
  try {
    await mailchimp.lists.addListMember(cfg.mailchimp.listId, {
      email_address: email.toLowerCase().trim(),
      status: 'subscribed',
      merge_fields: {},
      tags: []
    });
    console.log('[mailchimp] Successfully added email:', email);
  } catch (e) {
    // Handle specific error cases
    if (e?.response?.body?.title === 'Member Exists') {
      console.log('[mailchimp] Email already exists in list:', email);
      return;
    }
    
    // Log detailed error information for debugging
    console.error('[mailchimp] add error:', {
      message: e.message,
      status: e?.response?.status,
      statusText: e?.response?.statusText,
      body: e?.response?.body,
      email: email
    });
    
    // Re-throw for caller to handle if needed
    throw e;
  }
}

module.exports = { addToList, checkEmailExists };
