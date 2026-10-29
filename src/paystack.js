/* Paystack: mobile money collection and transfers for Ghana.
   Needs PAYSTACK_SECRET_KEY. With no key set, the app runs in "no MoMo" mode and only
   records cash. Docs: https://paystack.com/docs/payments/payment-channels/#mobile-money
   and https://paystack.com/docs/transfers/single-transfers/ */
const crypto = require('crypto');

const SECRET = () => process.env.PAYSTACK_SECRET_KEY || '';
const PUBLIC = () => process.env.PAYSTACK_PUBLIC_KEY || '';
const BASE = 'https://api.paystack.co';

/* Paystack's bank codes for Ghanaian mobile money networks. */
const PROVIDERS = { mtn: 'MTN', vodafone: 'VOD', airteltigo: 'ATL' };

function enabled() { return !!SECRET(); }

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: 'Bearer ' + SECRET(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) {
    const err = new Error(json.message || ('Paystack error ' + res.status));
    err.paystack = json;
    throw err;
  }
  return json.data;
}

/* Start a MoMo payment. The member is sent to Paystack's page, where they confirm on
   their phone. amount is in GHS; Paystack wants pesewas. */
async function initializeMomo({ email, amount, reference, callbackUrl, metadata }) {
  return call('POST', '/transaction/initialize', {
    email, amount: Math.round(amount * 100), currency: 'GHS', reference,
    channels: ['mobile_money'], callback_url: callbackUrl, metadata
  });
}
async function verify(reference) {
  return call('GET', '/transaction/verify/' + encodeURIComponent(reference));
}

/* Pay a collector out to their MoMo wallet. Transfers need a Paystack business account
   with transfers enabled and a funded balance. */
async function createRecipient({ name, phone, provider }) {
  const bank = PROVIDERS[provider];
  if (!bank) throw new Error('Unknown mobile money network: ' + provider);
  return call('POST', '/transferrecipient', {
    type: 'mobile_money', name, account_number: phone, bank_code: bank, currency: 'GHS'
  });
}
async function transfer({ recipientCode, amount, reference, reason }) {
  return call('POST', '/transfer', {
    source: 'balance', amount: Math.round(amount * 100), currency: 'GHS',
    recipient: recipientCode, reference, reason
  });
}

/* Webhook check: Paystack signs the raw body with the secret key (HMAC SHA-512). */
function validSignature(rawBody, signature) {
  if (!SECRET() || !signature) return false;
  const h = crypto.createHmac('sha512', SECRET()).update(rawBody).digest('hex');
  return h.length === signature.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(signature));
}

module.exports = { enabled, PUBLIC, PROVIDERS, initializeMomo, verify, createRecipient, transfer, validSignature };
