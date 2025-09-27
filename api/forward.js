// api/webhook.js
import fetch from 'node-fetch';

let lastPaypalRaw = "No PayPal payload received yet";
let lastAmount = "0.00 USD";
let lastInvoiceId = "No invoice_id";
let lastTransactionId = "No transaction ID";

// PayPal credentials
const PAYPAL_CLIENT_ID = "ASK7Hk7YyRS-jh6h6dqmxONNPjyx4gZXc1ZhY9dO6l1P1ggt4mOdXkpurySzZWkU6G_PtG3qVfi22MVz";
const PAYPAL_SECRET = "EAHTIg0RL66_PHBW_-3eEgORIVBm8WXHGNTRNtSMjRkR-BHwPGTWQM3o22IECCzCQhbl7kUDEB5DicII";
const PAYPAL_WEBHOOK_ID = "50B41732U3687421A"; // Your webhook ID
const SANDBOX = true;

const PAYPAL_OAUTH_URL = SANDBOX
  ? "https://api-m.sandbox.paypal.com/v1/oauth2/token"
  : "https://api-m.paypal.com/v1/oauth2/token";

const PAYPAL_VERIFY_URL = SANDBOX
  ? "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature"
  : "https://api-m.paypal.com/v1/notifications/verify-webhook-signature";

// Disable default body parsing
export const config = {
  api: {
    bodyParser: false,
  },
};

// Get access token from PayPal
async function getAccessToken() {
  const creds = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64");
  const res = await fetch(PAYPAL_OAUTH_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  return data.access_token;
}

// Verify webhook signature
async function verifyWebhookSignature(accessToken, bodyText, headers) {
  const res = await fetch(PAYPAL_VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(bodyText),
    }),
  });
  const data = await res.json();
  return data.verification_status === "SUCCESS";
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      // Read raw body
      let bodyText = "";
      await new Promise((resolve) => {
        let data = "";
        req.on("data", chunk => { data += chunk; });
        req.on("end", () => { bodyText = data; resolve(); });
      });

      // Extract PayPal headers
      const headers = {
        'paypal-transmission-id': req.headers['paypal-transmission-id'],
        'paypal-transmission-time': req.headers['paypal-transmission-time'],
        'paypal-transmission-sig': req.headers['paypal-transmission-sig'],
        'paypal-cert-url': req.headers['paypal-cert-url'],
        'paypal-auth-algo': req.headers['paypal-auth-algo'],
      };

      // Verify webhook
      const accessToken = await getAccessToken();
      const verified = await verifyWebhookSignature(accessToken, bodyText, headers);

      if (!verified) {
        console.error("Webhook signature verification failed");
        return res.status(400).json({ error: "Webhook verification failed" });
      }

      // Parse and store data
      const body = JSON.parse(bodyText);
      lastPaypalRaw = JSON.stringify(body, null, 2);

      const resource = body.resource || {};
      const amount = resource.amount || {};
      lastAmount = `${amount.value || "0.00"} ${amount.currency_code || "USD"}`;
      lastInvoiceId = resource.invoice_id || resource.custom_id || "No invoice_id";
      lastTransactionId = resource.id || "No transaction ID";

      console.log("Webhook received:", lastPaypalRaw);
      console.log("Parsed values:", { lastAmount, lastInvoiceId, lastTransactionId });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error processing webhook:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  if (req.method === "GET") {
    return res.status(200).send(`
<h2>Last PayPal Webhook Data</h2>
<p><strong>Amount:</strong> ${lastAmount}</p>
<p><strong>Invoice ID:</strong> ${lastInvoiceId}</p>
<p><strong>Transaction ID:</strong> ${lastTransactionId}</p>
<pre>${lastPaypalRaw}</pre>
`);
  }

  res.setHeader("Allow", ["POST", "GET"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}

