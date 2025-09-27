// api/webhook.js
import qs from 'querystring';
import fetch from 'node-fetch';

let lastAmount = "No payment received yet";
let lastInvoiceId = "Unknown";
let lastTransactionId = "Unknown";
let lastPaypalRaw = "No PayPal payload received yet";

// Replace these with your sandbox credentials
const PAYPAL_CLIENT_ID = "ASK7Hk7YyRS-jh6h6dqmxONNPjyx4gZXc1ZhY9dO6l1P1ggt4mOdXkpurySzZWkU6G_PtG3qVfi22MVz";
const PAYPAL_SECRET = "EAHTIg0RL66_PHBW_-3eEgORIVBm8WXHGNTRNtSMjRkR-BHwPGTWQM3o22IECCzCQhbl7kUDEB5DicII";

export const config = {
  api: { bodyParser: false }, // Disable automatic parsing
};

async function getPaypalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
  const resp = await fetch('https://api.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await resp.json();
  return data.access_token;
}

async function verifyWebhook(body, headers) {
  const accessToken = await getPaypalAccessToken();
  const resp = await fetch('https://api.sandbox.paypal.com/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: 'YOUR_SANDBOX_WEBHOOK_ID', // Replace with your webhook ID
      webhook_event: body
    }),
  });
  const data = await resp.json();
  return data.verification_status === 'SUCCESS';
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      let bodyText = '';
      await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => { bodyText = data; resolve(); });
      });

      // Parse JSON or fallback to form-encoded
      let body;
      try {
        body = JSON.parse(bodyText);
      } catch {
        const parsed = qs.parse(bodyText);
        const key = Object.keys(parsed)[0];
        body = JSON.parse(key);
      }

      lastPaypalRaw = JSON.stringify(body, null, 2);

      // Verify webhook
      const verified = await verifyWebhook(body, req.headers);
      if (!verified) {
        console.warn("Webhook verification failed!");
        return res.status(400).json({ error: 'Webhook verification failed' });
      }

      const resource = body.resource || {};
      const amount = resource.amount || {};
      lastAmount = `${amount.value || "0.00"} ${amount.currency_code || "USD"}`;
      lastInvoiceId = resource.invoice_id || resource.custom_id || "No invoice_id";
      lastTransactionId = resource.id || "No transaction ID";

      console.log("Webhook received:", lastPaypalRaw);
      console.log("Parsed values:", { lastAmount, lastInvoiceId, lastTransactionId });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error processing webhook:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (req.method === 'GET') {
    return res.status(200).send(`
<h2>Last PayPal Webhook Data</h2>
<p><strong>Amount:</strong> ${lastAmount}</p>
<p><strong>Invoice ID:</strong> ${lastInvoiceId}</p>
<p><strong>Transaction ID:</strong> ${lastTransactionId}</p>
<pre>${lastPaypalRaw}</pre>
`);
  }

  res.setHeader('Allow', ['POST','GET']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}

