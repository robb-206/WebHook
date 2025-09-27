// api/webhook.js
import qs from 'querystring';

let lastAmount = "No payment received yet";
let lastInvoiceId = "Unknown";
let lastTransactionId = "Unknown";
let lastPaypalRaw = "No PayPal payload received yet";

export const config = {
  api: {
    bodyParser: false, // Disable automatic parsing
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      let bodyText = '';
      await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => { bodyText = data; resolve(); });
      });

      // Attempt to parse JSON directly
      let body;
      try {
        body = JSON.parse(bodyText);
      } catch {
        // If parsing fails, treat as form-encoded
        const parsed = qs.parse(bodyText);
        // PayPal may send JSON as a key in form-encoded body
        const key = Object.keys(parsed)[0];
        body = JSON.parse(key);
      }

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
